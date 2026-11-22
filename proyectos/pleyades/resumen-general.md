# 🌌 Proyecto Pléyades — Plataforma Cloud-Native SaaS en Azure

> **Plataforma Cloud-Native Multi-Tenant SaaS, GitOps Declarativo, Crossplane & SRE en Microsoft Azure**
>
> **Autor:** Juan Diego López Zuluaga  
> **Rol:** DevOps, Cloud Platform & SRE Senior Engineer  
> **Ecosistema Nube:** Microsoft Azure (`eastus2` / `centralus`)  
> **Filosofía Operacional:** Trunk-Based Development, Zero Static Secrets (OIDC), Infrastructure as Code (Terraform), GitOps Pull-Based (ArgoCD), Internal Developer Platform (Crossplane), Arquitectura Limpia Hexagonal (Go 1.24) y Confiabilidad Matemática (Site Reliability Engineering & Ley de Little).

---

## 📑 1. Resumen Ejecutivo y Misión de Plataforma

**Proyecto Pléyades** representa la cúspide arquitectónica en la evolución de plataformas distribuidas del autor (sucediendo a *Sirius* en Big Data/FinOps y *Polaris* en Kubernetes IaaS/eBPF). 

El objetivo primordial de Pléyades es implementar una plataforma SaaS empresarial **Multi-Tenant de Alto Rendimiento y Aislamiento Estricto** en Microsoft Azure, gobernada 100% mediante código declarativo y diseñada para resistir auditorías rigurosas de seguridad DevSecOps y fiabilidad SRE:

1. **Gobernanza Declarativa GitOps (Pull-Based):** Eliminación total de despliegues push desde pipelines CI al clúster. La única fuente de verdad reside en Git; **ArgoCD** reconcilia y autorrepara continuamente el estado vivo del clúster AKS.
2. **Internal Developer Platform (IDP) con Crossplane:** Capacidad de auto-escalado horizontal de infraestructura de bases de datos relacionales en la nube. Cuando la densidad de inquilinos supera el umbral preventivo (5/7 tenants), la propia aplicación dispara la provisión autónoma de nuevos servidores **Azure Database for PostgreSQL Flexible Server** vía Custom Resources sin intervención humana ni secretos estáticos.
3. **Multi-Tenancy con Aislamiento Físico y Lógico (Database-per-Tenant):** Cada cliente cuenta con su propia base de datos PostgreSQL, usuario dedicado con contraseña aleatoria criptográfica efímera (*Show-Once Pattern*), revocación estricta de privilegios (`REVOKE CONNECT ON DATABASE ... FROM PUBLIC`), cuota estricta de conexiones por inquilino (`CONNECTION LIMIT 2`) y distribución en servidores shardeados (*Database Server Pools*).
4. **Ingeniería de Confiabilidad de Sitios (SRE) y Modelo Matemático de Capacidad:** Modelado determinista del Completely Fair Scheduler (CFS) de Linux, dimensionamiento del pool de conexiones contra límites reales del SKU B1ms, y derivación analítica de latencias mediante la **Ley de Little en sistema cerrado** ($R = \frac{N}{\lambda} - Z$), garantizando el cumplimiento de SLOs ($p95 < 1500\text{ ms}$ a 50 VUs concurrentes en derivación Bcrypt cost 10).
5. **Postura de Seguridad "Zero Static Secrets":** Integración de Azure Workload Identity y Microsoft Entra ID mediante federación OIDC en Terraform, GitHub Actions y Crossplane, prescindiendo por completo de contraseñas de larga duración o Service Principals tradicionales.

---

## 🏛️ 2. Topología de Repositorios y Separación de Responsabilidades

El proyecto se estructura estrictamente en **tres repositorios desacoplados**, garantizando el principio de responsabilidad única (*Single Responsibility Principle*) a nivel de repositorio y ciclo de vida:

```mermaid
flowchart TD
    subgraph Repo1["1. pleyades-infrastructure (Azure IaaS & Bootstrap)"]
        TF["Terraform Modular (main.tf / modules)"]
        TFState["Remote State: Azure Blob Storage (Blob Leases Lock)"]
        TF -->|"Aprovisiona IaaS"| AKS["AKS Cluster (Cilium eBPF KPR, Standard_D2s_v7)"]
        TF -->|"Bootstrap Inicial"| ArgoHelm["Helm Release: ArgoCD (Single-Replica ~500MB)"]
        TF -->|"Federación OIDC"| UAMI["User-Assigned Managed Identities (Workload Identity)"]
    end

    subgraph Repo2["2. pleyades-gitops (Platform, Crossplane & SRE)"]
        AppOfApps["ArgoCD App-of-Apps Master"]
        CrossplaneOp["Crossplane Operator (provider-azure-dbforpostgresql v2.8.4)"]
        SREStack["Stack SRE: kube-prometheus-stack + Grafana Dashboards"]
        GitOpsApp["Manifiestos App: Deployment, HPA, PDB, ConfigMap, K6-Job"]
        AppOfApps --> CrossplaneOp
        AppOfApps --> SREStack
        AppOfApps --> GitOpsApp
    end

    subgraph Repo3["3. pleyades-app (Microservicio Core SaaS en Go 1.24)"]
        CleanArch["Arquitectura Hexagonal: Domain / Ports / Adapters"]
        CryptoBcrypt["Bcrypt Hasher (cost 10) + CompareDummy (CSPRNG)"]
        ShardedProvisioner["Sharded Tenant Provisioner + K8s REST Trigger"]
        K6Suite["Suite k6: Load, Stress (300 VUs), Soak, Spike"]
        DistrolessCI["CI GitHub Actions: Multi-Stage Build -> Distroless OCI (10.3 MB)"]
    end

    subgraph AzureRuntime["Microsoft Azure Cloud Platform"]
        AKSNodePool["Node Pool: 2 Nodos Standard_D2s_v7 (4 vCPUs Cuota Regional)"]
        PaaSDB1["Azure PostgreSQL Flexible Server (psql-pleyades-dev-01, B1ms)"]
        PaaSDB2["Azure PostgreSQL Flexible Server Auto-escalado (psql-pleyades-dev-02)"]
    end

    Repo1 -->|Crea Clúster y VNet 10.0.0.0/16| AKSNodePool
    Repo2 -.->|ArgoCD Pull Sync & Auto-Healing| AKSNodePool
    DistrolessCI -->|Push Imagen Inmutable| GHCR["GitHub Packages (GHCR)"]
    GitOpsApp -.->|Despliega tag SHA| AKSNodePool
    AKSNodePool -->|Conexión nativa pgx/v5 (Pool=3/pod)| PaaSDB1
    ShardedProvisioner ==>|POST HTTPS K8s API -> Custom Resource| CrossplaneOp
    CrossplaneOp ==>|Workload Identity OIDC -> Provisiona| PaaSDB2
```

### 🔗 Enlaces Oficiales a los Repositorios del Ecosistema
* 🏗️ **Infraestructura IaC:** [pleyades-infrastructure](https://github.com/lopezzuluagaj3-collab/pleyades-infrastructure) — Terraform modular, AKS, Cilium eBPF, OIDC Entra ID, Azure Blob Storage tfstate.
* 🐙 **GitOps & Platform Control Plane:** [pleyades-gitops](https://github.com/lopezzuluagaj3-collab/pleyades-gitops) — ArgoCD App-of-Apps, Crossplane Azure Providers, SRE Observability, Ingress Controller y Manifiestos de Carga.
* ⚡ **Microservicio Core SaaS:** [pleyades-app](https://github.com/lopezzuluagaj3-collab/pleyades-app) — Go 1.24, Arquitectura Hexagonal, Multi-Tenancy Sharded Pools, k6 In-Cluster Suite y Contenedores Distroless.
