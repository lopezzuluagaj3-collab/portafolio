# 1. Arquitectura de Infraestructura como Código (IaC)

Este módulo documenta la arquitectura de Infraestructura como Código (IaC) desarrollada para **Pléyades** en Microsoft Azure mediante **Terraform**, la gestión del estado remoto con bloqueo nativo, la autenticación sin secretos estáticos mediante **OIDC** en Entra ID, la provisión de bases de datos gestionadas en regiones habilitadas y los scripts de bootstrap reproducibles en PowerShell.

---

## 🏛️ Decisiones de Arquitectura del Dominio (ADRs)

### 📌 ADR 02: Estructura Modular y Scaffolding Inicial en Terraform
* **Estado:** Aceptado e Implementado.
* **Decisión:** Estructurar el repositorio de infraestructura desacoplando la raíz de los servicios de nube mediante una carpeta `modules/`, donde cada servicio cuenta con cuatro archivos estándar: `main.tf`, `variables.tf`, `outputs.tf` y `locals.tf`.
* **Justificación:** 
  1. **Alta cohesión y bajo acoplamiento:** Facilita la evolución independiente de la red (`networking`), el cómputo (`aks`) y los grupos de recursos (`resource_group`).
  2. **Entrega incremental (Scaffolding primero):** Se prioriza desplegar el andamiaje arquitectónico y la inicialización del backend antes de la codificación de recursos complejos, validando la tubería de CI/CD desde el primer commit.
* **Alternativas consideradas:** Monolito de Terraform en un único directorio raíz (descartado por elevado radio de impacto (*blast radius*) y tiempos prolongados de ejecución); Terragrunt (descartado para evitar herramientas externas no estándar en etapas iniciales).
* **Trade-offs:** Requiere cableado explícito de variables y salidas (*outputs*) entre módulos, lo que incrementa la cantidad de archivos iniciales en comparación con un script plano.

---

### 📌 ADR 03: Gestión de Estado Remoto en Azure Blob Storage
* **Estado:** Aceptado e Implementado.
* **Decisión:** Configurar el backend de Terraform en un Azure Storage Account dedicado dentro de un Resource Group aislado (`rg-*-tfstate`), utilizando Azure Blob Storage con contenedor Blob para `tfstate`.
* **Justificación:**
  1. **Aislamiento de Privilegios:** El estado contiene metadata sensible y debe residir fuera de los grupos de recursos efímeros o de cargas de trabajo.
  2. **Bloqueo Nativo (*State Locking*):** Azure Blob Leases garantiza exclusión mutua automática durante ejecuciones concurrentes de `terraform apply` o `plan`, previniendo corrupción del estado.
* **Alternativas consideradas:** Almacenamiento local del estado versionado en Git (descartado por riesgo crítico de fuga de secretos y carencia de concurrencia segura); HCP Terraform / Terraform Cloud (descartado para mantener la soberanía del estado dentro del tenant de Azure sin dependencias SaaS externas).
* **Trade-offs:** Introduce un paso previo de bootstrapping imperativo para crear el Storage Account antes de poder ejecutar el primer `terraform init`.

---

### 📌 ADR 04: Seguridad "Zero Static Secrets" en Planos de Control Cloud mediante OIDC y Federated Credentials
* **Estado:** Aceptado e Implementado.
* **Decisión:** Eliminar totalmente el uso de secretos estáticos, contraseñas o *Service Principal Secrets* para la autenticación entre GitHub Actions y Azure. En su lugar, se implementa **Federated Identity Credentials** sobre una **User-Assigned Managed Identity (UAMI)** en Microsoft Entra ID.
* **Lección Técnica y Hallazgo Crítico (Immutable Subject Claims):**
  * GitHub emite tokens OIDC con formato inmutable (`repo:<org>@<org_id>/<repo>@<repo_id>:<context>`) para prevenir ataques de suplantación si se renombra la organización o el repositorio.
  * Azure Entra ID exige coincidencia estricta (*exact string match*). Si el sujeto no incluye los identificadores numéricos, la federación falla con el código `AADSTS700213`.
  * **Solución adoptada:** Se configuran credenciales federadas explícitas para cada contexto:
    1. **Pull Requests:** `repo:<org>@<org_id>/<repo>@<repo_id>:pull_request` (permite validación y `terraform plan`).
    2. **Rama Principal:** `repo:<org>@<org_id>/<repo>@<repo_id>:ref:refs/heads/main` (permite sincronización tras merge).
    3. **Entorno de Producción:** `repo:<org>@<org_id>/<repo>@<repo_id>:environment:production` (para ejecución controlada de `terraform apply`).
* **Consideraciones de Seguridad y Mínimo Privilegio (PoLP):**
  * En la configuración base de desarrollo, la identidad administrada cuenta con rol `Contributor` sobre la suscripción.
  * Como buena práctica de hardening empresarial, se aconseja separar en dos identidades administradas independientes: una identidad con rol `Reader` asignada al contexto `pull_request` (únicamente con permisos de lectura para calcular el `terraform plan`), y una identidad con rol `Contributor` restringida a la rama `main` y al entorno protegido `production` para ejecutar el `terraform apply`.
* **Alternativas consideradas:** Service Principal con Client Secrets tradicionales (descartado por riesgo de vencimiento de claves y fuga accidental en logs); Certificados X.509 de cliente (descartado por la sobrecarga de rotación y almacenamiento del certificado privado).
* **Trade-offs:** Mayor complejidad en la configuración inicial de federación en Entra ID y acoplamiento estricto a las claims inmutables emitidas por GitHub.

---

### 📌 ADR 30: Aprovisionamiento de Azure Database for PostgreSQL Flexible Server en Región Habilitada (`centralus`) y Conectividad Híbrida Segura TLS con Clúster AKS
* **Estado:** Aceptado e Implementado.
* **Decisión:** Aprovisionar una instancia gestionada de **Azure Database for PostgreSQL Flexible Server** (`psql-pleyades-dev-01`) en la región `centralus` utilizando SKU Burstable `Standard_B1ms` con almacenamiento de 32 GiB (auto-grow habilitado), backups locales automáticos (LRS con 7 días de retención y PITR), TLS/SSL obligatorio (`require_secure_transport = on`) y regla de firewall interna de Azure (`0.0.0.0` - `0.0.0.0`).
* **Lección Técnica y Hallazgo Crítico (Restricción Regional de Cuota):**
  * Al intentar aprovisionar en `eastus2` (donde reside el clúster AKS), Azure rechazó la solicitud con código HTTP 400: `ParameterOutOfRange: The value of the 'Version' should be in: []`. La verificación mediante Azure CLI confirmó que Microsoft restringe nuevas instancias de Flexible Server en `eastus2` para suscripciones estándar/estudiante (`supportedServerVersions: []`).
  * En contraste, la región **`centralus`** soporta versiones 11 a 18 sin restricciones de cuota.
  * Conectar una subred delegada de AKS en `eastus2` a `centralus` requeriría VNet Peering transcontinental.
  * **Solución adoptada:** Se desacopló la subred delegada (`delegated_subnet_id = null`), permitiendo conectividad directa a través de la red troncal de Microsoft (*Azure Backbone*) mediante la regla de firewall `allow-azure-internal` y forzando cifrado en tránsito estricto (`sslmode=require`) desde el pod en AKS.
* **Declaración de Riesgo Aceptado en Desarrollo (Firewall Rule 0.0.0.0):**
  * La regla `0.0.0.0` - `0.0.0.0` permite el tráfico desde cualquier servicio alojado dentro de los centros de datos de Azure (no exclusivamente de la suscripción del proyecto).
  * Este compromiso se asume como un riesgo aceptado para entornos de desarrollo y pruebas de concepto para eludir el coste y complejidad de un VNet Peering transcontinental entre `eastus2` y `centralus`. Para entornos productivos consolidados, se proyecta alojar AKS y las bases de datos en la misma región con delegación de subred privada estricta (*Private Endpoint / VNet Integration*).
* **Retiro y Desactivación del StatefulSet In-Cluster:** Con la puesta en marcha de `psql-pleyades-dev-01`, el StatefulSet de PostgreSQL en el clúster (`database/postgres-0`, ADR 10) fue escalado formalmente a 0 réplicas para liberar recursos de cómputo en AKS y evitar el riesgo operacional de split-brain en la persistencia.
* **Alternativas consideradas:** VNet Peering transcontinental entre `eastus2` y `centralus` (descartado por costes añadidos de transferencia inter-región y sobrecarga de enrutamiento para entornos de desarrollo); Migrar todo el clúster AKS a `centralus` (descartado para mantener el clúster en `eastus2` donde se cuenta con cuota aprobada de VMs v7).
* **Trade-offs:** La regla de firewall `0.0.0.0` confía enteramente la seguridad al cifrado en tránsito TLS obligatorio (`require_secure_transport = on`), la contraseña de alta entropía del superusuario y el aislamiento lógico por tenant.

---

## 🛠️ Runbook de Bootstrap: Pasos 1 al 5 (PowerShell)

### Paso 1: Definición de Variables Base
```powershell
# Variables de Azure
$LOCATION            = "eastus2"                       # Región para AKS y Networking
$RG_STATE_NAME       = "rg-pleyades-tfstate"           # Grupo de recursos del estado remoto
$STORAGE_ACC_NAME    = "stpleyadesstate"               # Nombre único del Storage Account
$CONTAINER_NAME      = "tfstate"                       # Contenedor Blob para el archivo tfstate
$IDENTITY_NAME       = "uami-github-pleyades-infra"    # Identidad administrada para CI/CD

# Variables de GitHub OIDC (obtenidas desde la organización y repositorio)
$GITHUB_ORG          = "lopezzuluagaj3-collab"
$GITHUB_ORG_ID       = "242297171"
$GITHUB_REPO         = "pleyades-infrastructure"
$GITHUB_REPO_ID      = "1448483627"

# Directorio Raíz de Trabajo
$PROJECT_ROOT        = "D:\proyectos\pleyades"
```

---

### Paso 2: Creación del Backend Remoto de Terraform
```powershell
# 1. Crear el Resource Group del estado
az group create --name $RG_STATE_NAME --location $LOCATION

# 2. Crear el Storage Account con redundancia local (LRS) y acceso público bloqueado
az storage account create `
  --name $STORAGE_ACC_NAME `
  --resource-group $RG_STATE_NAME `
  --location $LOCATION `
  --sku Standard_LRS `
  --encryption-services blob `
  --allow-blob-public-access false

# 3. Crear el contenedor Blob para el tfstate
az storage container create `
  --name $CONTAINER_NAME `
  --account-name $STORAGE_ACC_NAME `
  --auth-mode login
```

---

### Paso 3: Aprovisionamiento de la Identidad Administrada (OIDC)
```powershell
# 1. Crear la User-Assigned Managed Identity
az identity create `
  --name $IDENTITY_NAME `
  --resource-group $RG_STATE_NAME `
  --location $LOCATION

# 2. Capturar identificadores requeridos para RBAC y GitHub Secrets
$CLIENT_ID    = az identity show --name $IDENTITY_NAME --resource-group $RG_STATE_NAME --query "clientId" -o tsv
$PRINCIPAL_ID = az identity show --name $IDENTITY_NAME --resource-group $RG_STATE_NAME --query "principalId" -o tsv
$SUB_ID       = az account show --query "id" -o tsv
$STORAGE_ID   = az storage account show --name $STORAGE_ACC_NAME --resource-group $RG_STATE_NAME --query "id" -o tsv
```

---

### Paso 4: Creación de Credenciales Federadas (Federated Identity Credentials)
Configura la relación de confianza criptográfica con GitHub Actions considerando las *claims* inmutables:

```powershell
# A. Credencial para Pull Requests (Validaciones de Lint, SAST y Terraform Plan)
az identity federated-credential create `
  --name "gha-pull-requests" `
  --identity-name $IDENTITY_NAME `
  --resource-group $RG_STATE_NAME `
  --issuer "https://token.actions.githubusercontent.com" `
  --subject "repo:${GITHUB_ORG}@${GITHUB_ORG_ID}/${GITHUB_REPO}@${GITHUB_REPO_ID}:pull_request" `
  --audiences "api://AzureADTokenExchange"

# B. Credencial para Push a la rama principal (Main)
az identity federated-credential create `
  --name "gha-main-branch" `
  --identity-name $IDENTITY_NAME `
  --resource-group $RG_STATE_NAME `
  --issuer "https://token.actions.githubusercontent.com" `
  --subject "repo:${GITHUB_ORG}@${GITHUB_ORG_ID}/${GITHUB_REPO}@${GITHUB_REPO_ID}:ref:refs/heads/main" `
  --audiences "api://AzureADTokenExchange"

# C. Credencial para el Entorno de Producción (Terraform Apply controlado)
az identity federated-credential create `
  --name "gha-prod-env" `
  --identity-name $IDENTITY_NAME `
  --resource-group $RG_STATE_NAME `
  --issuer "https://token.actions.githubusercontent.com" `
  --subject "repo:${GITHUB_ORG}@${GITHUB_ORG_ID}/${GITHUB_REPO}@${GITHUB_REPO_ID}:environment:production" `
  --audiences "api://AzureADTokenExchange"
```

---

### Paso 5: Asignación de Roles RBAC (Entorno de Desarrollo vs. Mínimo Privilegio PoLP)

#### A. Configuración Aplicada en Desarrollo (Identidad Federada Única)
```powershell
# 1. Permiso de lectura/escritura y blob leasing sobre el tfstate (indispensable para state locking)
az role assignment create `
  --assignee $PRINCIPAL_ID `
  --role "Storage Blob Data Contributor" `
  --scope $STORAGE_ID

# 2. Permiso para desplegar y administrar infraestructura en la suscripción
az role assignment create `
  --assignee $PRINCIPAL_ID `
  --role "Contributor" `
  --scope "/subscriptions/$SUB_ID"
```

#### B. Arquitectura de Mínimo Privilegio Recomendada para Producción (Doble Identidad)
Para cumplir con PoLP en entornos empresariales:
1. **Identidad para Pull Requests (`uami-ci-plan`):**
   - Sujeto: `repo:${GITHUB_ORG}@${GITHUB_ORG_ID}/${GITHUB_REPO}@${GITHUB_REPO_ID}:pull_request`
   - Rol en Suscripción: `Reader` (inspección de recursos existentes para computar el plan sin mutación).
   - Rol en Storage Account: `Storage Blob Data Contributor` (adquisición de lease para bloqueo de estado).
2. **Identidad para Despliegues (`uami-ci-apply`):**
   - Sujeto: `ref:refs/heads/main` y `environment:production`
   - Rol en Suscripción: `Contributor` o rol personalizado delimitado a los Resource Groups de Pléyades.
   - Rol en Storage Account: `Storage Blob Data Contributor`.
