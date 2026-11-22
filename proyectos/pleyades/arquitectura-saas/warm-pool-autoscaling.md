# 3. Aprovisionamiento Just-in-Time y Warm Pool Preventivo

Este módulo documenta el mecanismo de auto-escalado horizontal de bases de datos de **Pléyades**, la estrategia de aprovisionamiento en caliente (*Warm Pool Provisioning*), el amortiguamiento de tiempos de encendido en Azure (~6 a 14 minutos), el control determinista de nombres y el manejo idempotente de concurrencia.

---

## 🏛️ Decisiones de Arquitectura del Dominio (ADRs)

### 📌 ADR 33: Aprovisionamiento Autónomo en Caliente (*Warm Pool Provisioning*) con Kubernetes REST Trigger y RBAC Mínimo Segregado
* **Estado:** Aceptado e Implementado en `apps/app/rbac.yaml` (PR #23).
* **Decisión:** Implementar la arquitectura de auto-escalado horizontal de bases de datos en caliente (*Warm Pool Provisioning*) para garantizar continuidad sin latencia al saturar servidores:
  1. **Umbral Preventivo de Capacidad:** Se definió la constante de dominio `PoolScaleThresholdTenants = 5` en `DatabasePool`. Al registrar el 5to inquilino en un servidor con capacidad para 7, la aplicación evalúa si existe otro servidor activo con espacio; si no existe, inicia proactivamente el aprovisionamiento del siguiente servidor (`psql-pleyades-dev-02`).
  2. **Disparador Nativo sin Dependencias Pesadas (`K8sPoolScaleTrigger`):** En lugar de incorporar la voluminosa librería `client-go` (~200 MB de dependencias indirectas), el microservicio utiliza un cliente HTTPS nativo en Go sobre `net/http` que consume el token y certificado CA proyectados en `/var/run/secrets/kubernetes.io/serviceaccount`, comunicándose directamente con la API de Kubernetes (`https://kubernetes.default.svc/apis/dbforpostgresql.azure.upbound.io/v1beta2/flexibleservers`).
  3. **Seguridad RBAC y Segregación Estricta de Mínimo Privilegio (PoLP):**
     - Las Custom Resource Definitions de Crossplane (`flexibleservers.dbforpostgresql.azure.upbound.io`) son recursos de ámbito de clúster (*Cluster-scoped*). Se definió un `ClusterRole` y `ClusterRoleBinding` (`pleyades-app-pool-provisioner`) exclusivo para crear y observar dichos CRDs, eliminando cualquier permiso sobre secretos.
     - **Segregación de Conexión a Secrets (`crossplane-system`):** La lectura de Secrets se segregó en un `Role` y `RoleBinding` (`pleyades-app-crossplane-secret-reader`) acotado estrictamente al namespace `crossplane-system`, impidiendo que el ServiceAccount de la app pueda leer secretos transversales del clúster (como admin de ArgoCD, Grafana, TLS o JWT).
  4. **Catálogo GitOps y Onboarding en Base de Datos:** Se documentó la plantilla declarativa en `apps/database-pools/template-flexible-server.yaml` de `pleyades-gitops`, estandarizando los parámetros de Azure Flexible Server en `centralus`. Una vez que Crossplane y Azure marcan el nuevo servidor como `Ready=True` y se genera el secreto de conexión (`psql-pleyades-dev-02-conn` en `crossplane-system`), en la fase actual el onboarding del nuevo servidor en la tabla `database_pools` se realiza mediante un script/query operacional de alta de pool. Como evolución arquitectónica en el roadmap (OPS-04), se proyecta un operador de Kubernetes (reconciler daemon) que observe el secreto y registre automáticamente el nuevo pool en caliente.
* **Control de Costes y Gobernanza FinOps:**
  1. **Tope de Auto-Escalado (Cost Cap):** Para prevenir sobrecostes imprevistos por creaciones masivas o ataques de denegación de servicio económico, la lógica de auto-escalado implementa un límite máximo de pools activos (`MaxAllowedPools = 3`), requiriendo aprobación manual de un operador si se alcanza el umbral.
* **Alternativas consideradas:** Usar `client-go` oficial de Kubernetes (descartado por inflar el binario con más de 200 MB de dependencias indirectas); ClusterRole con permisos globales de lectura de Secrets (descartado por violar flagrantemente el principio de mínimo privilegio y exponer credenciales críticas del plano de control).
* **Trade-offs:** La segregación de RBAC requiere coordinar manifiestos en namespaces cruzados (`pleyades-app` y `crossplane-system`), exigiendo referencias explícitas en los RoleBindings.

---

### 📌 ADR 34: Verificación Operacional End-to-End del Auto-Escalado Autónomo de Servidores de Bases de Datos con Crossplane
* **Estado:** Aceptado e Implementado y Verificado Operacionalmente.
* **Decisión & Validación:** Ejecución y verificación en vivo del disparo y aprovisionamiento autónomo E2E de auto-escalado horizontal preventivo (con onboarding asistido en `database_pools`, ver ADR 33 y OPS-04):
  1. **Inyección de Identidad y RBAC:** El pod en producción adopta el `ServiceAccount: pleyades-app-sa` asociado al `ClusterRole: pleyades-app-pool-provisioner`.
  2. **Inyección de Inquilinos y Detección de Umbral:** Se crearon secuencialmente los inquilinos `acmecloud`, `orioncorp`, `solaris`, `andromeda` y `nebula` vía API REST protegida con JWT e Idempotencia.
  3. **Disparo Autónomo Cloud-Native:** Al registrar el 5to inquilino (`nebula`), el provisionador shardeado detectó el umbral (`current_tenants + 1 >= 5`) e invocó `K8sPoolScaleTrigger`, enviando un POST HTTPS autenticado contra la API REST de Kubernetes sin dependencias pesadas.
  4. **Aceptación y Conciliación Crossplane:** El clúster aceptó el Custom Resource `psql-pleyades-dev-02` (v1beta2), y el operador Upbound Crossplane asumió la identidad federada Workload Identity (`fic-crossplane-dbforpostgresql`) para ordenar el aprovisionamiento de `psql-pleyades-dev-02` en Azure `Central US`.
  5. **Reglas de Red Declarativas:** Se enlazaron las reglas de firewall `psql-pleyades-dev-02-allow-azure` (`0.0.0.0` - `0.0.0.0`) y la base de datos maestra `psql-pleyades-dev-02-pleyades-db` mediante resolución de referencias declarativas (`serverIdRef`).
* **Evidencia Operacional (Salida Verificada en CLI):**
  ```shell
  $ kubectl get flexibleservers.dbforpostgresql.azure.upbound.io
  NAME                   READY   SYNCED   EXTERNAL-NAME          AGE
  psql-pleyades-dev-02   True    True     psql-pleyades-dev-02   14m

  $ az postgres flexible-server show --name psql-pleyades-dev-02 -g rg-pleyades-dev --query "{name:name, state:state, version:version, location:location, sku:sku.name}" -o json
  {
    "location": "Central US",
    "name": "psql-pleyades-dev-02",
    "sku": "Standard_B1ms",
    "state": "Ready",
    "version": "16"
  }
  ```

---

## ⚡ Lógica de Amortiguamiento y Protección de Concurrencia

```
Tenant 1..4 (Inmediato) ──► Asignados a Pool 1 (Server 1)
Tenant 5     (Inmediato) ──► Asignado a Pool 1 + Dispara CRD psql-pleyades-dev-02 (Azure ~6-14 min)
Tenant 6 & 7 (Inmediato) ──► Absorción en los 2 slots restantes de Pool 1 (Cero espera de usuario)
Tenant 8 (Si Server 2 Listo) ──► Asignado a Pool 2 (Server 2) de forma transparente
Tenant 8 (Si Server 2 Tarda) ──► HTTP 503 / 429 con Retry-After: 120 (Protección Fail-Safe)
```

### Garantías Criptográficas y de Idempotencia en Código:
1. **Determinismo de Nombres en Kubernetes:** El nombre del Custom Resource emitido hacia Crossplane es estrictamente determinista (`psql-pleyades-dev-02` en `pool_trigger.go:73`).
2. **Manejo Nativo de `409 Conflict`:** Si dos inquilinos cruzan el umbral simultáneamente (en milisegundos), ambas peticiones intentan crear el CRD. La primera responde `HTTP 201 Created`; la segunda recibe `HTTP 409 Conflict`. El adaptador captura el 409 como un éxito idempotente:
   ```go
   // internal/adapters/kubernetes/pool_trigger.go
   if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusConflict {
       return nil // Idempotente: el recurso ya existe y Crossplane lo está reconciliando
   }
   ```
   Esto previene deterministamente la duplicación accidental de servidores en Azure.
