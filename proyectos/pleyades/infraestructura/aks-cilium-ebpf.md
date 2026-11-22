# 2. Cómputo AKS y Networking eBPF con Cilium

Este módulo documenta la topología de cómputo en **Azure Kubernetes Service (AKS)**, la arquitectura de red de alto rendimiento gobernada por **Cilium CNI en modo eBPF directo**, la eliminación de `kube-proxy`, la resolución de colisiones de CIDRs y el análisis de gobernanza de cuotas de cómputo en la nube.

---

## 🏛️ Decisiones de Arquitectura del Dominio (ADRs)

### 📌 ADR 06: Aprovisionamiento de AKS con Cilium eBPF, Standard_D2s_v7 y CIDRs Desacoplados
* **Estado:** Aceptado e Implementado.
* **Decisión:** Aprovisionar el clúster gestionado de AKS (`aks-pleyades-dev`) utilizando:
  1. **Node Pool Sizing & SKU:** Máquina virtual `Standard_D2s_v7` (2 vCPUs, 8 GiB RAM) con auto-escalado entre 1 y 2 nodos en desarrollo/evaluación, y `min_count = 2` en el perfil de producción multi-nodo (ADR 22).
  2. **Data Plane / CNI:** **Azure CNI Overlay** motorizado por **Cilium eBPF nativo** y **Kube-Proxy Replacement (KPR)**.
  3. **Desacoplamiento de Rangos de Red (CIDRs):** Asignar explícitamente `service_cidr = "172.16.0.0/16"`, `dns_service_ip = "172.16.0.10"` y `pod_cidr = "10.244.0.0/16"`.
  4. **Seguridad Cloud-Native:** OIDC Issuer y Azure Workload Identity activados.
* **Justificación y Hallazgos Críticos:**
  1. **Límite de Cuota Regional en Azure:** La suscripción cuenta con una cuota estricta de 4 vCPUs regionales en `eastus2`. Las familias B y D v3/v4/v5 presentan restricciones de capacidad en la suscripción. La familia v7 (`Standard_D2s_v7`) cuenta con disponibilidad y cuota aprobada en las zonas de disponibilidad de `eastus2`. Con 1 nodo inicial y máximo 2 nodos, el clúster nunca excede el tope de 4 vCPUs.
  2. **Prevención de Colisión de Red (`ServiceCidrOverlapExistingSubnetsCidr`):** En modo Overlay, Azure asigna `10.0.0.0/16` por defecto a los Services si no se especifica. Dado que la VNet reside en `10.0.0.0/16` y la subred de AKS en `10.0.1.0/24`, el aprovisionamiento fallaba. El desacoplamiento a `172.16.0.0/16` garantiza aislamiento total entre IPs de red física y ClusterIPs de Kubernetes.
  3. **Tensión Operacional de Cuota vs. PodDisruptionBudget y Upgrades de Nodos (ADR 37):** Con una cuota regional estricta de 4 vCPUs (exactamente 2 nodos `Standard_D2s_v7`), un clúster no puede ejecutar un node upgrade de AKS con la política por defecto de `maxSurge: 1` (que intenta provisionar un 3er nodo transitorio de 2 vCPUs alcanzando 6 vCPUs por `QuotaExceeded`).
     - **Viabilidad Condicional de `maxSurge: 0` (Reemplazo In-Place):** La estrategia de actualización secuencial in-place (`maxSurge: 0`) **únicamente es viable cuando el clúster ya opera con 2 nodos activos (`min_count = 2`)**, permitiendo que al drenar el Nodo A sus pods sean reubicados en el Nodo B satisfaciendo el PDB (`minAvailable: 2`).
     - **Deadlock en Clúster de 1 Solo Nodo:** Si el clúster operase con 1 solo nodo, ejecutar `maxSurge: 0` produce un bloqueo insalvable (*deadlock*): el comando de drenado (`kubectl drain`) intenta desalojar los pods, pero la API de Kubernetes rechaza la expulsión porque el PDB exige 2 réplicas disponibles y no existe ningún otro nodo en el clúster adonde evacuarlos.
     - **Estrategias de Mitigación Operacional:** Para actualizar un clúster de nodo único bajo cuota de 4 vCPUs, se debe:
       1) Gestionar un incremento temporal de cuota a 6 vCPUs en Azure Portal para permitir `maxSurge: 1`, o bien
       2) Reducir transitoriamente el PDB a `minAvailable: 1` antes de ejecutar el upgrade in-place con `maxSurge: 0`, aceptando degradación temporal durante la ventana de mantenimiento programada.
* **Alternativas consideradas:** CNI Kubenet tradicional (descartado por penalización de rendimiento en enrutamiento mediante iptables y límite arquitectónico estricto de 250 pods por nodo en Azure AKS); Azure CNI clásico sin Overlay (descartado por consumo voraz de IPs privadas en la subred de la VNet); Calico CNI (descartado por mayor consumo de memoria y CPU frente a Cilium eBPF con KPR).
* **Trade-offs:** Reemplazar iptables y kube-proxy por programas eBPF en el kernel de Linux requiere kernels recientes y herramientas especializadas (`cilium-cli`) para depuración avanzada de red.

---

## ⚡ Data Plane eBPF vs. iptables Tradicional

En Kubernetes estándar, el componente `kube-proxy` programa cadenas de reglas secuenciales en `iptables` de Linux. Conforme se crean cientos de servicios y endpoints en una plataforma SaaS multi-inquilino, el tiempo de búsqueda se degrada a complejidad lineal $\mathcal{O}(N)$.

Cilium reemplaza completamente este mecanismo interceptando las llamadas de socket a nivel del subsistema eBPF del kernel:

```
[ Paquete de Red ] ──► [ eBPF Socket Filter ] ──► [ eBPF Map Lookup O(1) ] ──► [ Pod Destino ]
                               │
                      (Cero cadenas iptables)
                      (Kube-Proxy Replacement)
```

### Tabla Comparativa de Networking

| Característica | Networking Tradicional (iptables) | Pléyades (Cilium eBPF Native) | Beneficio Operacional |
| :--- | :--- | :--- | :--- |
| **Complejidad de Enrutamiento** | $\mathcal{O}(N)$ (búsqueda secuencial) | $\mathcal{O}(1)$ (hash table BPF en kernel) | Latencia sub-milisegundo constante sin importar la cantidad de Services. |
| **Consumo de Memoria CPU** | Alto en recargas continuas de reglas | Mínimo (inyección bytecode nativo JIT) | Ahorro de ciclos de CPU para las cargas de negocio de la app. |
| **Visibilidad de Tráfico** | Básica (logs de conntrack) | Profunda (Hubble L3/L4/L7 Flow Monitor) | Trazabilidad visual de conexiones DNS, TCP y HTTP en tiempo real. |
| **Modelo de Red** | Subnet IP exhaustion en VNet | Azure CNI Overlay (`10.244.0.0/16`) | Escala a miles de pods sin agotar el espacio de direccionamiento privado. |
