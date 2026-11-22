# 2. Ingeniería de Confiabilidad de Sitios (SRE) y Observabilidad

Este módulo documenta el stack de observabilidad de **Pléyades**, la implementación de los *4 Golden Signals* de Google SRE, la mitigación de cuellos de botella de red y perimétricos, la suite completa de pruebas de rendimiento con **k6**, y la ejecución in-cluster mediante Kubernetes Jobs.

---

## 🏛️ Decisiones de Arquitectura del Dominio (ADRs)

### 📌 ADR 11: Stack SRE y Observabilidad con kube-prometheus-stack y Server-Side Apply
* **Estado:** Aceptado e Implementado.
* **Decisión:** Desplegar la suite oficial de observabilidad y confiabilidad **`kube-prometheus-stack`** (v68.4.4) mediante ArgoCD en el namespace `monitoring`, adoptando el modelo arquitectónico de **Cerebro Central vs Sensores Distribuidos**:
  1. **Sensores Ligeros Distribuidos (`node-exporter`):** Desplegado como `DaemonSet` obligatorio. Cada nuevo nodo aprovisionado dinámicamente por autoescalado recibe automáticamente una réplica de ~15 MiB de RAM para recolectar métricas del kernel y hardware.
  2. **Cerebro Central Único (`Prometheus`):** Instancia única con *Service Discovery* que centraliza las métricas de todos los nodos y aplicaciones a través del data plane de Cilium eBPF, con persistencia en Azure Managed Disk (5 GiB, `managed-csi`) y retención de 12 horas.
  3. **Visualización Centralizada (`Grafana`):** Panel único para los *4 Golden Signals* de SRE (Latencia, Tráfico, Errores y Saturación).
  4. **Resolución de Límite de CRD con Server-Side Apply:** Habilitar `ServerSideApply=true` en las opciones de sincronización de ArgoCD para eludir el límite de 262.144 bytes (256 KB) de la anotación `kubectl.kubernetes.io/last-applied-configuration` generado por las CRDs del Prometheus Operator.
  5. **Resolución de Schema Mismatch (`terminatingReplicas` en K8s 1.31+):** Kubernetes v1.31+ incorporó el campo `.status.terminatingReplicas` a los controladores de `apps` (`Deployment`, `StatefulSet`, `ReplicaSet`, `DaemonSet`). Al usar *Server-Side Apply*, el validador estático OpenAPI de ArgoCD 2.13 detecta este campo no declarado y arroja `ComparisonError`. Se mitigó declarando `spec.ignoreDifferences` en la Application para ignorar dicho puntero JSON en todos los controladores.
  6. **Hardening de Cargas en AKS:** Desactivar monitores de `kubeEtcd`, `kubeScheduler` y `kubeControllerManager`, ya que en clústeres gestionados de Azure AKS residen en el plano de control administrado por Microsoft.
* **Justificación y Métricas:**
  1. **Consumo de Memoria Reducido:** El stack completo consume únicamente **~600 a 750 MiB de RAM**, preservando entre ~4.6 y 4.8 GiB libres en el nodo (~5.8 GiB allocatables) para los microservicios de negocio.
  2. **Elasticidad Multi-Nodo:** Permite que las métricas de cualquier nuevo nodo creado por el Cluster Autoscaler se integren instantáneamente en Grafana sin duplicar bases de datos ni consolas.
* **Alternativas consideradas:** Azure Monitor / Container Insights (descartado por costos variables y vendor lock-in); Datadog o New Relic (descartados por costos de suscripción SaaS); Prometheus Vanilla sin Operator (descartado por la dificultad de administrar ServiceMonitors y PrometheusRules de forma declarativa en GitOps).
* **Trade-offs:** Demanda entre 600 y 750 MiB de memoria RAM en el clúster y requiere configurar Server-Side Apply en ArgoCD para superar el límite de 256 KB en la metadata de las CRDs.

---

### 📌 ADR 20: Observabilidad Cloud-Native con Prometheus y Middleware Desacoplado (SRE Golden Signals)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Implementar la instrumentación de métricas de Prometheus (`internal/adapters/http/metrics.go`) siguiendo el principio de responsabilidad única (SRP) y Clean Architecture mediante un middleware HTTP:
  1. **Desacoplamiento Total de Negocio:** La capa de dominio (`domain`) y los casos de uso (`usecase`) no importan Prometheus ni conocen la existencia de métricas. Toda la recolección opera como un decorador transparente a nivel del adaptador HTTP.
  2. **Decorador Atómico de Respuestas (`statusRecorder`):** Componente dedicado exclusivamente a interceptar el código de estado HTTP (`statusCode`) devuelto por los handlers sin alterar el flujo de escritura del body.
  3. **Funciones de Medición Atómicas:**
     - `incInFlight()` / `decInFlight()`: Manejo del gauge de concurrencia en tiempo real (`http_requests_in_flight`).
     - `observeDuration()`: Registro de latencia en histograma con buckets estándar (`http_request_duration_seconds{method, path}`).
     - `countRequest()`: Incremento del contador acumulativo clasificado por verbo, ruta y código de respuesta (`http_requests_total{method, path, status}`).
  4. **Orquestador Central (`Middleware`):** Función de alto nivel que coordina la toma de tiempo, la invocación de `next.ServeHTTP()` y la recolección de las métricas atómicas, ignorando el endpoint `/metrics` para no sesgar los datos estadísticos.
  5. **Exposición de Métricas:** Registro del endpoint `GET /metrics` mediante `promhttp.Handler()` en `router.go`.
* **Justificación e Impacto para Pruebas de Carga con k6:**
  1. **Cumplimiento de los Golden Signals de Google SRE:** Permite calcular en Grafana en tiempo real:
     - Tasa de Peticiones (RPS) mediante `rate(http_requests_total[1m])`.
     - Tasa de Errores porcentual (`status=~"5.."` vs totales).
     - Latencias en percentiles críticos (p50, p95, p99) mediante `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))`.
  2. **Saturación In-Flight:** Permite detectar cuellos de botella instantáneos donde las peticiones se encolan antes de que el pod agote su CPU o memoria, habilitando al Horizontal Pod Autoscaler (HPA) a reaccionar proactivamente.
* **Alternativas consideradas:** Instrumentar manualmente cada caso de uso o método de repositorio (descartado por contaminar la lógica de negocio con bibliotecas de telemetría); Trazabilidad distribuida con OpenTelemetry Collector (descartado en fases iniciales por consumo adicional de memoria).
* **Trade-offs:** Cada petición HTTP entrante ejecuta el envoltorio de interceptación y actualización atómica de contadores, agregando una sobrecarga insignificante de microsegundos en la latencia global.

---

### 📌 ADR 22: Suite Modular de Pruebas de Rendimiento (Load, Stress, Soak y Spike) con k6 y Modelo de Capacidad vs. SLOs (SRE)
* **Estado:** Aceptado e Implementado en rama `feat/k6-load-testing` y alineado en PR #32.
* **Decisión Técnica:**
  1. **Arquitectura Desacoplada y Reutilizable (SOLID / OCP / SRP):**
     - `k6/config.js`: Centraliza variables de entorno (`TARGET_URL`, `SOAK_DURATION`, `SOAK_VUS`), umbrales de SLOs (*Thresholds*) y los 4 perfiles de tráfico.
     - `k6/generators.js`: Genera payloads sintéticos respetando invariantes de dominio y garantizando unicidad mediante `__VU`, `__ITER` y timestamps para evitar colisiones de correo (`409 Conflict`).
     - `k6/client.js`: Transporte HTTP aislado y etiquetado con tags para Prometheus.
     - `k6/assertions.js`: Valida de forma atómica código 201, headers y UUID, reportando métricas de Golden Signals (`Counter`, `Rate`, `Trend`).
     - `k6/runner.js`: Encapsula el ciclo de vida del Virtual User con think-time de 100ms.
  2. **Cuatro Escenarios Especializados:**
     - **Carga (Load Test - `load_test.js`):** Simula tráfico esperado con rampas hasta 50 VUs evaluando el SLO bajo saturación de CPU.
     - **Estrés (Stress Test - `stress_test.js`):** Empuja la carga progresivamente hasta 300 VUs para identificar el punto de quiebre (*breaking point*) y disparar réplicas del HPA en Kubernetes.
     - **Resistencia (Soak / Endurance Test - `soak_test.js`):** Carga continua moderada (20-30 VUs) durante períodos prolongados (30m a 2h) para auditar fugas de memoria, conexiones huérfanas en PostgreSQL y estabilidad del Garbage Collector en Kubernetes.
     - **Picos (Spike Test - `spike_test.js`):** Ráfaga violenta e instantánea de 200 VUs en 10s para evaluar la resiliencia del Ingress Controller y el socket buffer.
  3. **Ejecución In-Cluster en AKS vía Kubernetes Job ([PR #33](https://github.com/lopezzuluagaj3-collab/pleyades-app/pull/33) y [PR #34](https://github.com/lopezzuluagaj3-collab/pleyades-app/pull/34) en App; [PR #25](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/25) y [PR #26](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/26) en GitOps):**
     - Para evitar que las pruebas de carga y estrés se vean falseadas por el cuello de botella del túnel SPDY de `kubectl port-forward` (que se conecta a un solo pod y satura el API Server de Kubernetes), se implementó un Job nativo (`apps/app/k6-load-test-job.yaml` y `k6/k8s-job.yaml`) con la imagen oficial `grafana/k6:0.56.0`.
     - Este Job se ejecuta dentro del clúster AKS, monta los scripts desde el ConfigMap `k6-test-scripts`, y dispara las peticiones directamente contra el ClusterIP `http://pleyades-app-service.pleyades-app.svc.cluster.local:8080`. Esto permite que el CNI Cilium eBPF distribuya la carga uniformemente entre todas las réplicas activas, permitiendo validar el comportamiento real del Horizontal Pod Autoscaler (HPA) sin exponer puertos HTTP al exterior.
* **Resultados Empíricos de Benchmark en Entorno Local (Línea Base):**
  - **Prueba de Carga (50 VUs - 1m40s):** 2,900 registros, **100% de éxito (0 errores)**, throughput de ~29 req/s, latencia p95 de 1.43s.
  - **Prueba de Estrés (300 VUs - 5m00s):** 8,826 peticiones, **98.30% de éxito** (8,676 usuarios creados). Tasa de fallo contenida en 1.69% (150 EOFs por desbordamiento de socket local bajo 300 VUs).
  - **Prueba de Picos (200 VUs en 10s):** 1,666 peticiones, **99.87% de éxito** (solo 2 fallos).
* **Modelo de Capacidad Física, Límites de Cómputo en Kubernetes (CFS Quotas) vs. SLOs (Fuente de Verdad Única):**
  - **Límites de CPU y Throttling en Kubernetes (CFS Quotas):** La derivación de claves Bcrypt (`cost=10`) consume estrictamente **~70ms de tiempo continuo de CPU**. Con `limits.cpu: 800m` ([PR #34](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/34)) y 5 pods distribuidos en 2 nodos `Standard_D2s_v7` (`min_count = 2`), descontando el consumo de plataforma (0.4–0.6 vCPUs) y el tope CFS de 1.6 vCPUs en el nodo con 2 pods, la aplicación dispone de $\approx \mathbf{3.0\text{ a }3.2\text{ vCPUs útiles}}$ ($\approx \mathbf{43\text{ a }46\text{ hashes/s}}$).
  - **Segregación Estricta de SLOs y Capacidad por Ley de Little:**
    - **1 Solo Nodo (~1.8 vCPUs allocatables, ~25 hashes/s):** $R = \frac{50}{25} - 0.1 = \mathbf{1.90\text{ s}}$ de tiempo de respuesta medio total (SLO formal: $p95 < 2500\text{ ms}$).
    - **Producción Multi-Nodo (2 Nodos Activos con `min_count = 2`, ~43 req/s):** $R = \frac{50}{43} - 0.1 = \mathbf{1.06\text{ s}}$ de tiempo de respuesta medio total (SLO de negocio cumplido: **$p95 < 1500\text{ ms}$** y **$p99 < 2000\text{ ms}$** a 50 VUs concurrentes).
    - **Operaciones I/O Puras:** SLO formal en **$p95 < 50\text{ ms}$**.

---

### 📌 ADR 35: Aprovisionamiento de Ingress-NGINX y Enrutamiento DNS en Capa 7 (Reemplazado por ADR 36)
* **Estado:** Reemplazado por ADR 36 (Aceptado e Implementado inicialmente en GitOps [PR #18](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/18) y [PR #19](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/19)).
* **Decisión Técnica Original:** Desplegar `ingress-nginx` v4.11.3 en `apps/ingress-nginx.yaml` vía ArgoCD asignando IP pública dinámica y etiqueta DNS en Azure, con rutas Ingress en texto plano (puerto 80) para `/` (`pleyades-app`), `/argocd` y `/grafana`.
* **Justificación de la Enmienda:** Exponer consolas administrativas y la API transaccional (que transporta contraseñas de login, JWTs y contraseñas Show-Once) sobre HTTP plano constituía una vulnerabilidad crítica (CWE-319). Por principio de inmutabilidad de los ADRs, esta configuración inicial queda reemplazada formalmente por el **ADR 36**.

---

### 📌 ADR 36: Deshabilitación Declarativa de Rutas Ingress HTTP y Aislamiento Administrativo vía Port-Forwarding (Reemplazo del ADR 35)
* **Estado:** Aceptado e Implementado en GitOps (PR #21 y PR #23).
* **Decisión Técnica y Clarificación Perimetral:**
  1. **Deshabilitación Declarativa de Rutas HTTP en Ingress (`resources: []`):** Se vaciaron declarativamente todas las definiciones de enrutamiento en `apps/ingress-routes/kustomization.yaml` (`resources: []`), garantizando que el controlador rechace de plano (`404 Not Found`) cualquier petición externa y eliminando la exposición de ArgoCD, Grafana y `pleyades-app` sobre tráfico plano no cifrado.
  2. **Aislamiento Administrativo y de Desarrollo vía Port-Forwarding:** Acceso interactivo a ArgoCD (`localhost:8081`), Grafana (`localhost:3000`) y API restringido a túneles cifrados `kubectl port-forward`.
  3. **Ejecución In-Cluster de Pruebas de Rendimiento:** Desacopladas de port-forward y ejecutadas como Kubernetes Job (`apps/app/k6-load-test-job.yaml`) contra el ClusterIP interno, aprovechando el balanceo eBPF de Cilium.
  4. **Roadmap TLS:** Despliegue de `cert-manager` v1.16 con `ClusterIssuer` Let's Encrypt para forzar HTTPS (puerto 443).

---

## 🛠️ Runbook de Bootstrap: Paso 10 (PowerShell)

### Paso 10: Ejecución de la Suite de Rendimiento con k6 y Monitoreo SRE

#### Opción A: Pruebas In-Cluster en AKS con Kubernetes Job (Recomendada para HPA y Estrés)
Ejecuta la suite k6 dentro del clúster AKS para validar el balanceo con Cilium eBPF y el escalado de pods:

```powershell
# 1. Crear o actualizar el ConfigMap con los scripts de prueba k6 en AKS:
kubectl create configmap k6-test-scripts --from-file=k6/ -n pleyades-app --dry-run=client -o yaml | kubectl apply -f -

# 2. Desplegar el Job de pruebas de carga distribuido en AKS:
kubectl apply -f apps/app/k6-load-test-job.yaml

# 3. Monitorear los logs de ejecución de k6 y el autoescalado de pods en paralelo:
kubectl logs -f job/k6-load-test -n pleyades-app
kubectl get hpa pleyades-app-hpa -n pleyades-app -w
kubectl get pods -n pleyades-app -l app.kubernetes.io/name=pleyades-app -w

# 4. Limpieza del Job al finalizar la prueba:
kubectl delete -f apps/app/k6-load-test-job.yaml
```

#### Opción B: Pruebas Locales y Sanity Checks de Depuración
```powershell
cd $PROJECT_ROOT\pleyades-app

# 1. Asegurar que PostgreSQL y el microservicio estén corriendo (para pruebas en local)
docker start pleyades-postgres
go run ./cmd/pleyades-app

# 2. Prueba de Carga Estándar Local (Load Test: 50 VUs)
k6 run k6/load_test.js

# 3. Sanity Check contra AKS vía Port-Forward (1 VU - Verificación de Conectividad):
# Terminal 1: kubectl port-forward svc/pleyades-app-service 8080:8080 -n pleyades-app
# Terminal 2: k6 run -e TARGET_URL="http://localhost:8080" -u 1 -d 10s k6/load_test.js

# 4. Prueba de Resistencia Local (Soak Test - Auditoría de Conexiones y Leaks):
k6 run -e TARGET_URL="http://localhost:8080" k6/soak_test.js

# 5. Prueba de Picos Local (Spike Test - Avalancha repentina de 200 VUs en 10s):
k6 run -e TARGET_URL="http://localhost:8080" k6/spike_test.js

# 6. Inspección de métricas Prometheus y Golden Signals:
Invoke-RestMethod -Uri http://localhost:8080/metrics

# 7. Acceso a Consola Grafana SRE (Dashboard Golden Signals y Saturación):
# kubectl port-forward svc/kube-prometheus-stack-grafana 3000:80 -n monitoring
# Abrir: http://localhost:3000 (admin / prom-operator)
```
