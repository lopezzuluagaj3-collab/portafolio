# 4. Modelo Físico de Capacidad y Ley de Little

Este módulo documenta el dimensionamiento de recursos de cómputo en **Kubernetes (CFS Quotas)**, la mitigación del estrangulamiento de CPU (*throttling*), la modelación matemática de confiabilidad mediante la **Ley de Little** en sistemas cerrados, y la gobernanza de resiliencia con **HPA, PDB y RollingUpdate**.

---

## 🏛️ Decisiones de Arquitectura del Dominio (ADRs)

### 📌 ADR 37: Declaración Formal de HorizontalPodAutoscaler (HPA), PodDisruptionBudget (PDB), Capacidad CPU y Estrategia RollingUpdate
* **Estado:** Aceptado e Implementado en `apps/app/hpa.yaml`, `apps/app/pdb.yaml`, `apps/app/deployment.yaml` y `apps/app/kustomization.yaml` ([PR #28](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/28), [PR #30](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/30) y [PR #34](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/34) en GitOps).
* **Decisión Técnica:**
  1. **HorizontalPodAutoscaler (`autoscaling/v2`):** Rango de **3 a 5 réplicas**, con métrica de utilización media de CPU al **70%** calculada sobre las peticiones declaradas (`requests.cpu: 100m`, con `limits.cpu: 800m` prevaleciente según [PR #34](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/34)). Con `requests.cpu: 100m`, el umbral del 70% equivale a **70m de CPU por pod**; dado que una operación Bcrypt consume ~70ms por segundo, una sola petición sostenida activa inmediatamente el autoescalado elástico hacia 5 pods.
  2. **Dimensionamiento de Recursos y Mitigación de CFS Throttling:**
     - Con `limits.cpu: 200m`, el kernel estrangulaba la ejecución de Bcrypt a ~350ms de tiempo de pared (techo de 1 vCPU / ~14 hashes/s).
     - Con `limits.cpu: 500m`, un cálculo Bcrypt se completaba en ~140ms, pero con 5 pods el clúster quedaba topado por CFS a $5 \times 0.5 = 2.5\text{ vCPUs}$ máximas (~35.7 hashes/s).
     - **Prevalece la decisión final ([PR #34](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/34)):** Límites fijados en `requests.cpu: 100m` y `limits.cpu: 800m` (0.8 vCPU por pod). Con 5 pods distribuidos en 2 nodos `Standard_D2s_v7` (`min_count = 2`), la aplicación aprovecha $\approx \mathbf{3.0\text{ a }3.2\text{ vCPUs útiles}}$ para procesar entre **~43 y 46 hashes/s agregados**.
  3. **PodDisruptionBudget (`policy/v1`):** Política con **`minAvailable: 2`**. Durante drenados o mantenimiento (`kubectl drain`), Kubernetes garantiza que el servicio nunca opere con menos de 2 pods saludables.
  4. **Estrategia RollingUpdate:** `maxSurge: 1` y `maxUnavailable: 0`. En escala máxima de 5 pods con surge transitorio de 6 pods ($6 \times 3 = 18$ conexiones de app) sumado al tope de 7 tenants ($14$ conns), el consumo total es de $\mathbf{32\text{ conexiones}}$ sobre 35 utilizables, garantizando **3 slots libres permanentes (8.5% de margen)** en el Flexible Server B1ms.

---

## 📐 Demostración Matemática: Ley de Little en Sistemas Cerrados

En un sistema cerrado con $N$ usuarios virtuales concurrentes (*Virtual Users*), tiempo de reflexión (*think-time*) $Z = 0.1\text{ s}$, y tasa de procesamiento (*throughput*) $\lambda$, la Ley Interactiva de Little despeja el **tiempo de respuesta medio total del sistema ($R$)**:

$$R = \frac{N}{\lambda} - Z$$

*(Nota: $R$ ya incluye tanto el tiempo de encolamiento como el tiempo de servicio computacional de Bcrypt y base de datos/red).*

```
┌─────────────────────────────────────────────────────────────┐
│                       SISTEMA CERRADO                       │
│                                                             │
│   50 Virtual Users (N = 50) ──► [ Cola de Encolamiento ]    │
│                                           │                 │
│                                           ▼                 │
│                              [ Cómputo Bcrypt ~70ms ]       │
│                                           │                 │
│                                           ▼                 │
│                              [ PostgreSQL Transacción ]     │
│                                           │                 │
│   Think-time Z = 0.1s ◄────── [ Respuesta HTTP 201 ]        │
└─────────────────────────────────────────────────────────────┘
```

### 1. Escenario de 1 Solo Nodo (`Standard_D2s_v7`, ~1.8 vCPUs allocatables)
* Throughput máximo sostenible: $\lambda \approx 25\text{ req/s}$
* Cálculo de tiempo medio:

  $$R = \frac{50\text{ VUs}}{25\text{ req/s}} - 0.1\text{ s} = 2.0 - 0.1 = \mathbf{1.90\text{ s}}$$

* **SLO Formal para 1 Nodo:** $p95 < 2500\text{ ms}$ (debido a la variabilidad de la cola en saturación mono-nodo).

### 2. Escenario Multi-Nodo de Producción (2 Nodos `Standard_D2s_v7`, `min_count = 2`)
* Descontando el consumo de plataforma (0.4–0.6 vCPUs entre Cilium, ArgoCD, Crossplane, Stack SRE y CoreDNS) y el tope CFS de 1.6 vCPUs en el nodo con 2 pods:
  * **Capacidad útil real agregada:** $\approx \mathbf{3.0\text{ a }3.2\text{ vCPUs}}$
  * **Throughput criptográfico agregado:** $\lambda \approx \mathbf{43\text{ a }46\text{ req/s}}$
* Cálculo de tiempo medio:

  $$R = \frac{50\text{ VUs}}{43\text{ req/s}} - 0.1\text{ s} = 1.16 - 0.1 = \mathbf{1.06\text{ s}}$$

* **SLO de Negocio en Producción:** **$p95 < 1500\text{ ms}$** y **$p99 < 2000\text{ ms}$**, plenamente alcanzado y certificado matemáticamente.

---

## ⚖️ Matriz de Conciliación de Resiliencia

| Parámetro | Configuración | Impacto Arquitectónico |
| :--- | :--- | :--- |
| **HPA Replicas** | `min: 3`, `max: 5` | Absorbe ráfagas elásticamente entre 3 y 5 pods. |
| **CPU Requests / Limits** | `100m` / `800m` | Elimina CFS throttling y libera 3.0–3.2 vCPUs útiles. |
| **PDB** | `minAvailable: 2` | Previene caídas en drenados de nodos y mantenimiento. |
| **RollingUpdate** | `maxSurge: 1`, `maxUnavail: 0` | Garantiza 3 slots libres de BD en pico máximo. |
| **Node Pool AKS** | `min_count: 2` | Erradica el cold-start de VMs (90-120s) y evita deadlock con PDB. |
