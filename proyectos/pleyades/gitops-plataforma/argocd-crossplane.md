# 1. GitOps con ArgoCD y Plataforma de Autoservicio con Crossplane

Este módulo documenta el plano de control declarativo de **Pléyades**, el motor de reconciliación continua con **ArgoCD**, la plataforma de autoservicio de infraestructura en la nube (**Crossplane IDP**) autenticada con Workload Identity (OIDC), el pipeline de promoción cross-repositorio y la gestión de secretos en el clúster AKS.

---

## 🏛️ Decisiones de Arquitectura del Dominio (ADRs)

### 📌 ADR 05: Pipeline CI/CD Desacoplado por Jobs Concurrente en GitHub Actions
* **Estado:** Aceptado e Implementado.
* **Decisión:** Refactorizar el flujo de CI/CD de infraestructura separando cada etapa de validación en **Jobs independientes** (`validate-fmt`, `tflint`, `security-checkov`, `infracost`, `terraform-plan`, `notify`, `apply`) y descartar herramientas pesadas autogestionadas innecesarias para IaC pura.
* **Justificación:**
  1. **Paralelismo y Velocidad:** Formateo, análisis estático y escaneos de seguridad se ejecutan simultáneamente en múltiples runners, reduciendo drásticamente el tiempo de feedback en los PRs.
  2. **Visibilidad granular:** Permite identificar fallos específicos de forma visual en la interfaz de GitHub sin interrumpir validaciones no dependientes.
  3. **Seguridad y Control:** El despliegue (`apply`) está estrictamente condicionado a la aprobación de la rama principal y la protección del entorno `production`.
* **Alternativas consideradas:** Pipeline secuencial monolítico de un solo job (descartado por tiempos de feedback lentos superiores a 15 minutos); Servidor autogestionado de SonarQube in-cluster para IaC (descartado por costos y sobrecarga operativa frente a linters nativos como TFLint y Checkov).
* **Trade-offs:** Incrementa el consumo de minutos de runners de GitHub Actions al levantar múltiples máquinas virtuales efímeras en paralelo.

---

### 📌 ADR 07: Bootstrap Automatizado de ArgoCD mediante Terraform Helm Provider
* **Estado:** Aceptado e Implementado.
* **Decisión:** Desplegar el motor GitOps **ArgoCD** de forma 100% automatizada e idempotente desde Terraform mediante el provider oficial `hashicorp/helm` (recurso `helm_release.argocd`, chart `argo/argo-cd` v7.7.16 / ArgoCD v2.13.3) en el namespace `argocd`.
* **Justificación:**
  1. **Resolución del problema del "Huevo y la Gallina" en GitOps:** Para que la plataforma sea reproducible sin intervención humana, la infraestructura debe auto-instalar el agente GitOps antes de delegarle el ciclo de vida del clúster.
  2. **Arquitectura Single-Replica para Optimización de Recursos:** Se desactiva la alta disponibilidad de Redis (`global.redis.ha.enabled = false`) y el módulo Dex SSO, fijando 1 réplica por componente. Esto reduce el consumo de memoria de ArgoCD a solo ~500 MB RAM, dejando más de 5 GB libres en el nodo de trabajo para cargas de negocio y observabilidad.
* **Alternativas consideradas:** Instalación manual con `kubectl apply -f install.yaml` (descartado por carecer de reproducibilidad e integración con IaC); Operador GitOps Flux v2 (descartado en favor de la interfaz gráfica y madurez del ecosistema de sincronización de ArgoCD).
* **Trade-offs:** Acopla temporalmente el ciclo de vida de un release de Helm dentro de la ejecución de Terraform durante el aprovisionamiento inicial.

---

### 📌 ADR 08: Compuertas de Seguridad DevSecOps para Repositorio GitOps
* **Estado:** Aceptado e Implementado.
* **Decisión:** Implementar un pipeline de CI en GitHub Actions para `pleyades-gitops` compuesto por cuatro validaciones paralelas: `yamllint` (sintaxis), `gitleaks` (prevención de fuga de secretos), `kubeconform` (validación de esquemas OpenAPI de K8s y CRDs) y `trivy config` (auditoría CIS Benchmark).
* **Justificación:** En una arquitectura GitOps pura con sincronización automática en ArgoCD, no existe una etapa de CD manual; el merge a `main` es el comando de despliegue a producción. Por lo tanto, el CI en el PR es la única compuerta de seguridad para impedir que configuraciones vulnerables, credenciales o manifiestos rotos lleguen al clúster AKS.
* **Alternativas consideradas:** Validación exclusiva en hooks locales de pre-commit (descartado por ser eludibles con `--no-verify` y no ofrecer garantías centralizadas); Revisiones manuales por pares sin automatización (descartadas por inconsistencia y lentitud).
* **Trade-offs:** Añade ~1-2 minutos al tiempo de validación de los Pull Requests en el repositorio de GitOps.

---

### 📌 ADR 09: Crossplane Azure Storage Provider con Workload Identity (OIDC) y ArgoCD Sync Waves
* **Estado:** Aceptado e Implementado.
* **Decisión:** 
  1. **Arquitectura Modular de Proveedores:** Descartar el paquete monolítico `provider-azure` de Upbound e implementar paquetes granulares por servicio: `xpkg.upbound.io/upbound/provider-family-azure` (paquete base) y `xpkg.upbound.io/upbound/provider-azure-storage` (v2.8.4).
  2. **Zero Static Secrets con Azure Workload Identity:** Autenticar el controlador de Crossplane mediante federación OIDC entre el emisor de tokens del clúster AKS y la identidad administrada `uami-crossplane-pleyades` (`fic-crossplane-storage`), eliminando contraseñas o secretos estáticos en Kubernetes.
  3. **Personalización del Runtime:** Configurar un `DeploymentRuntimeConfig` (`azure-storage-runtime`) que anota el `ServiceAccount` con el `client-id` y añade la etiqueta `azure.workload.identity/use: "true"`, activando el webhook mutador de AKS para inyectar automáticamente el token proyectado `/var/run/secrets/azure/tokens/azure-identity-token` y variables de entorno (`AZURE_CLIENT_ID`, `AZURE_FEDERATED_TOKEN_FILE`).
  4. **Orquestación GitOps con Sync Waves:** Separar el ciclo de vida en Waves de ArgoCD: Wave `0` para el `DeploymentRuntimeConfig` y los `Providers`; Wave `1` para el `ProviderConfig` (con la anotación `argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true`) para evitar fallos de dry-run previo al registro de las CRDs en la API de Kubernetes.
* **Justificación y Métricas:**
  1. **Consumo de Memoria Reducido:** El paquete monolítico consume entre 1.5 y 2 GB de RAM e instala más de 1000 CRDs, saturando el nodo único `Standard_D2s_v7`. La arquitectura modular consume solo ~300 MB de RAM y registra únicamente las CRDs requeridas (`accounts`, `blobs`, `containers`, `shares`).
  2. **Equivalencia Cloud:** En AWS, este patrón corresponde exactamente a vincular Crossplane con **AWS IRSA (IAM Roles for Service Accounts)**.
* **Alternativas consideradas:** Proveedor monolítico `provider-azure` de Upbound (descartado por consumo excesivo de memoria); Inyección de secretos estáticos vía Secret de Kubernetes (descartado por violar los principios de seguridad de la plataforma).
* **Trade-offs:** Exige declarar paquetes y configuraciones de runtime individualizados para cada familia de recursos de Azure requerida.

---

### 📌 ADR 29: Pipeline de Promoción Automatizada Cross-Repository y Entrega Continua GitOps (ArgoCD)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Implementar el patrón de arquitectura de plataformas **Automated Cross-Repository GitOps Promotion**:
  1. **Desacoplamiento Estricto de Repositorios:** La aplicación de negocio (`pleyades-app`) y el estado declarativo del clúster (`pleyades-gitops`) residen en repositorios separados para mantener el principio de responsabilidad única.
  2. **Publicación Inmutable en GitHub Container Registry (GHCR):** Al fusionar cambios validados a `main` en `pleyades-app`, el pipeline publica la imagen de contenedor con dos etiquetas: el commit SHA inmutable (`ghcr.io/lopezzuluagaj3-collab/pleyades-app:<sha>`) y `latest`.
  3. **Disparador Automatizado de Pull Requests:** Utilizando un *Fine-Grained Personal Access Token (PAT)* con permisos mínimos exclusivos sobre `pleyades-gitops` (`Contents: Write`, `Pull Requests: Write`), el pipeline de `pleyades-app` clona el repositorio de GitOps, actualiza `apps/app/deployment.yaml` con el nuevo hash de imagen, y abre automáticamente un Pull Request de promoción.
  4. **Adopción por App-of-Apps:** `pleyades-gitops` expone el recurso `apps/app.yaml` bajo el namespace `pleyades-app`, con probes de salud (`/healthz`, `/readyz`), usuario nonroot (UID 65532) y `ServiceMonitor` vinculado a `monitoring-stack` para auto-descubrimiento en Prometheus y Grafana.
* **Justificación:**
  1. **Auditoría e Inmutabilidad:** Cada cambio de versión en producción queda registrado como un Pull Request auditable en Git con trazabilidad al commit exacto del código fuente.
  2. **Zero Downtime:** La aprobación del PR gatilla la reconciliación autónoma de ArgoCD en AKS mediante *RollingUpdate*.
* **Alternativas consideradas:** Repositorio mono-repo donde convivan código Go y manifiestos GitOps (descartado por acoplamiento de ciclos de vida y riesgo de re-despliegues innecesarios de infraestructura); Promoción manual editando el tag de la imagen directamente en Git (descartado por lentitud operativa y propensión a errores humanos).
* **Trade-offs:** Requiere un Personal Access Token (PAT) almacenado en los Secrets de GitHub Actions con permisos de escritura sobre el repositorio de GitOps, el cual debe monitorearse y rotarse periódicamente.

---

### 📌 ADR 32: Orquestación Declarativa de PostgreSQL Flexible Server con Crossplane Azure Provider y Workload Identity
* **Estado:** Aceptado e Implementado.
* **Decisión:** Desplegar el proveedor modular **`provider-azure-dbforpostgresql`** (v2.8.4) de Upbound Crossplane en el clúster AKS para la gestión autónoma del plano de control de bases de datos:
  1. **Federación OIDC Específica:** Se creó la credencial federada `fic-crossplane-dbforpostgresql` en Microsoft Entra ID vinculada al sujeto `system:serviceaccount:crossplane-system:provider-azure-dbforpostgresql` sobre la Managed Identity `uami-crossplane-pleyades` (rol *Contributor* en la suscripción).
  2. **Configuración de Runtime GitOps:** Se declaró `DeploymentRuntimeConfig` (`azure-dbforpostgresql-runtime`) con mutación automática de Workload Identity (`azure.workload.identity/use: "true"`), limitando recursos a 500m CPU y 512Mi RAM.
  3. **Habilitación de Custom Resource Definitions (CRDs):** Registra las CRDs oficiales `flexibleservers.dbforpostgresql.azure.upbound.io`, `flexibleserverfirewallrules` y `flexibleserverdatabases`, permitiendo que el clúster o los microservicios aprovisionen servidores ADBFP directamente como objetos nativos de Kubernetes sin credenciales estáticas ni interacción manual en el portal de Azure.
* **Consideración de Mínimo Privilegio (PoLP):**
  * Para desarrollo inicial, la Managed Identity de Crossplane cuenta con rol *Contributor* en la suscripción.
  * Como recomendación de seguridad para producción, el alcance (scope) de este rol debe acotarse estrictamente al Resource Group de la plataforma (`rg-pleyades-dev`), impidiendo que el operador tenga permisos sobre otros grupos de recursos de la suscripción.
* **Alternativas consideradas:** Pipelines de Terraform disparados por API/webhooks (descartado por introducir desacoplamiento asíncrono y carecer del bucle de reconciliación continua nativo de Kubernetes que ofrece Crossplane); Operadores de Postgres in-cluster (Zalando / Crunchy Data) (descartado por consumir CPU y almacenamiento local en AKS en vez de aprovechar bases de datos gestionadas de Azure).
* **Trade-offs:** El operador de Crossplane mantiene controladores de reconciliación continua en ejecución que consumen entre 150 y 250 MiB de RAM en el namespace `crossplane-system`.

---

## 🛠️ Runbook de Bootstrap: Pasos 6 y 7 (PowerShell)

### Paso 6: Configuración de Secrets en GitHub Actions (CI/CD)

#### A. Repositorio `pleyades-infrastructure` (Federación OIDC de Azure)
| Secret | Comando / Origen | Propósito |
| :--- | :--- | :--- |
| `AZURE_CLIENT_ID` | `az identity show --name $IDENTITY_NAME -g $RG_STATE_NAME --query "clientId" -o tsv` | Client ID de la Identidad Administrada UAMI. |
| `AZURE_TENANT_ID` | `az account show --query "tenantId" -o tsv` | ID del inquilino de Microsoft Entra ID. |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query "id" -o tsv` | ID de la suscripción de Azure donde opera el clúster. |

#### B. Repositorio `pleyades-app` (Promoción GitOps Automatizada)
| Secret | Comando / Origen | Propósito |
| :--- | :--- | :--- |
| `GITOPS_PROMOTION_TOKEN` | GitHub Developer Settings ➔ Personal Access Token (Fine-grained) | Token con permisos `Contents: Write` y `Pull Requests: Write` sobre `pleyades-gitops` para abrir PRs de promoción automática. |

---

### Paso 7: Inyección y Gestión de Secrets en el Clúster de Kubernetes (AKS)

Siguiendo el principio de **Zero Static Secrets en Git (DevSecOps)**, los manifiestos versionados en `pleyades-gitops` (`apps/app/secret.yaml`) contienen valores de plantilla (`CHANGE_ME_IN_K8S_SECRET`). La aplicación de ArgoCD (`apps/app.yaml`) tiene configurado `spec.ignoreDifferences` en `/data/DB_PASSWORD` y `/data/JWT_SECRET`, lo que permite que las credenciales reales se inyecten directamente en el clúster sin que GitOps las sobrescriba.

```powershell
# 1. Obtener credenciales del clúster AKS
az aks get-credentials --resource-group rg-pleyades-dev --name aks-pleyades-dev --overwrite-existing

# 2. Variables de producción (Zero Static Secrets en Git)
$DB_PASSWORD_PROD = "<TU_PASSWORD_AZURE_POSTGRES>"   # Contraseña de administrador de psql-pleyades-dev-01
$JWT_SECRET_PROD  = "<TU_CLAVE_JWT_MINIMO_32_BYTES>" # Secreto simétrico HMAC-SHA256 para firmar sesiones

kubectl create secret generic pleyades-app-secret -n pleyades-app `
  --from-literal=DB_USER="pleyades_admin" `
  --from-literal=DB_PASSWORD="$DB_PASSWORD_PROD" `
  --from-literal=JWT_SECRET="$JWT_SECRET_PROD" `
  --dry-run=client -o yaml | kubectl apply -f -
```

#### Inventario Completo de Secrets en el Clúster AKS

| Namespace | Nombre del Secret | Tipo / Gestión | Propósito |
| :--- | :--- | :--- | :--- |
| `pleyades-app` | `pleyades-app-secret` | Opaque (Manual / ArgoCD `ignoreDifferences`) | Credenciales de conexión a Azure Database for PostgreSQL (`DB_USER`, `DB_PASSWORD`) y clave simétrica para JWT (`JWT_SECRET`). |
| `database` | `postgres-secret` | Opaque (GitOps declarativo) | Credenciales para la base de datos in-cluster de desarrollo (`POSTGRES_USER`, `POSTGRES_PASSWORD`). Versionado en Git exclusivamente para el entorno efímero de desarrollo local (marcado con `# gitleaks:allow`). StatefulSet escalado a 0 réplicas en AKS tras migrar a Azure Flexible Server (ADR 10 y ADR 30). |
| `crossplane-system` | *Sin secretos estáticos* | **Azure Workload Identity (OIDC)** | Crossplane **no** almacena credenciales fijas de Azure. Se autentica mediante token federado proyectado (`fic-crossplane-storage` y `fic-crossplane-dbforpostgresql`). |
| `crossplane-system` | `psql-pleyades-dev-02-conn` | Opaque (Auto-generado por Crossplane) | Secreto de conexión generado automáticamente por Crossplane al aprovisionar servidores de bases de datos secundarios (`writeConnectionSecretToRef`). |
| `argocd` | `argocd-initial-admin-secret` | Opaque (Auto-generado por Helm) | Contraseña inicial de administrador generada durante el bootstrap de ArgoCD. |
| `monitoring` | `monitoring-grafana` | Opaque (Gestionado por Helm) | Credenciales administrativas de Grafana (`admin` / `prom-operator`). |
