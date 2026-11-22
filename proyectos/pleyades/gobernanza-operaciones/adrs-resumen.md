# 1. Bitácora de Decisiones de Arquitectura (ADRs 01 al 37)

Este registro formal documenta las decisiones de diseño arquitectónico (Architecture Decision Records - ADRs) que estructuran el ecosistema **Pléyades** en Azure. Para mantener la auditabilidad histórica y la transparencia técnica, las decisiones arquitectónicas que evolucionan ante nuevos hallazgos de seguridad, capacidad o compuertas de calidad no se eliminan arbitrariamente, sino que se enmiendan y reemplazan formalmente mediante versiones trazables (como el reemplazo explícito del ADR 35 por el ADR 36).

---

## 📑 Matriz de Navegación Arquitectónica (37 ADRs)

| ADR | Dominio | Decisión Principal | Capítulo Temático Detallado |
| :--- | :--- | :--- | :--- |
| **01** | Git Strategy | Trunk-Based Development & Convención de Commits (Anti-`git add .`) | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **02** | IaC (Terraform) | Arquitectura Modular y Scaffolding Inicial en Terraform | [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **03** | IaC (Terraform) | Backend Remoto en Azure Blob Storage con State Locking | [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **04** | Seguridad Cloud | Zero Static Secrets en Planos de Control (Azure OIDC & UAMI) | [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **05** | CI/CD | Pipeline Concurrente en GitHub Actions | [ArgoCD & Crossplane](../gitops-plataforma/argocd-crossplane.md) |
| **06** | Cómputo (AKS) | AKS con Cilium eBPF, Standard_D2s_v7 y CIDRs Desacoplados | [AKS & Cilium eBPF](../infraestructura/aks-cilium-ebpf.md) |
| **07** | GitOps | Bootstrap de ArgoCD vía Terraform Helm Provider (Single-Replica) | [ArgoCD & Crossplane](../gitops-plataforma/argocd-crossplane.md) |
| **08** | DevSecOps | Compuertas de Calidad GitOps (yamllint, gitleaks, kubeconform, trivy) | [ArgoCD & Crossplane](../gitops-plataforma/argocd-crossplane.md) |
| **09** | Cloud Control Plane | Crossplane Azure Storage Provider con Workload Identity y Sync Waves | [ArgoCD & Crossplane](../gitops-plataforma/argocd-crossplane.md) |
| **10** | Bases de Datos | PostgreSQL StatefulSet in-cluster (managed-csi) [Retirado en AKS] | [Multi-Tenancy & Sharding](../arquitectura-saas/multi-tenancy-sharding.md) |
| **11** | SRE & Monitoreo | kube-prometheus-stack con Server-Side Apply | [SRE & Observabilidad](../gitops-plataforma/sre-observabilidad.md) |
| **12** | DevSecOps | Quality & Security Gates en Microservicio Go (7 compuertas) | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **13** | Backend Go | Arquitectura Limpia Hexagonal (Ports & Adapters) en Go 1.24 | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **14** | Bases de Datos | Dimensionamiento del Pool de Conexiones a PostgreSQL frente a HPA | [Multi-Tenancy & Sharding](../arquitectura-saas/multi-tenancy-sharding.md) |
| **15** | Cloud-Native | Configuración Fail-Fast (12-Factor App) | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **16** | Backend Go | Principio de Responsabilidad Única (SRP) en Handlers HTTP | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **17** | Seguridad | Hashing Bcrypt con CompareDummy y mitigación timing attacks | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **18** | DevSecOps | Resolución Estricta de Alertas SAST (Gosec G304 y SonarCloud S2077) | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **19** | Kubernetes | Graceful Shutdown Cooperativo (SIGTERM, 10s de gracia) | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **20** | SRE | Observabilidad Prometheus con Middleware Desacoplado | [SRE & Observabilidad](../gitops-plataforma/sre-observabilidad.md) |
| **21** | Testing | Pruebas Unitarias Aisladas y Mocks Basados en Closures | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **22** | SRE & Testing | Suite Modular de Rendimiento k6 y Modelo de Capacidad vs. SLOs | [SRE & Observabilidad](../gitops-plataforma/sre-observabilidad.md) |
| **23** | Backend Go | Pipeline de Middlewares Transversales (Chain, Sliding Session, Limiter) | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **24** | Seguridad | Endpoint de Login, Emisión de JWT y CompareDummy | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **25** | Multi-Tenancy | Aislamiento Lógico (Database-per-Tenant) y Cota de Slug (30 chars) | [Multi-Tenancy & Sharding](../arquitectura-saas/multi-tenancy-sharding.md) |
| **26** | Seguridad | Patrón Show-Once y Retención Volátil en Idempotencia | [Multi-Tenancy & Sharding](../arquitectura-saas/multi-tenancy-sharding.md) |
| **27** | Documentación | Swagger UI y Especificación Swagger 2.0 / OpenAPI 2.0 | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **28** | Contenerización | Multi-Stage Distroless Non-Root (UID 65532, 10.3 MB) | [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **29** | GitOps | Pipeline de Promoción Automatizada Cross-Repo (ArgoCD) | [ArgoCD & Crossplane](../gitops-plataforma/argocd-crossplane.md) |
| **30** | Cloud DB (Azure) | Azure PostgreSQL Flexible Server en Central US y Firewall 0.0.0.0 | [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **31** | Multi-Tenancy | Sharded Database Server Pools (Bin-Packing 5-7 Tenants) | [Multi-Tenancy & Sharding](../arquitectura-saas/multi-tenancy-sharding.md) |
| **32** | Cloud Control Plane | Crossplane Azure DB for PostgreSQL Provider | [ArgoCD & Crossplane](../gitops-plataforma/argocd-crossplane.md) |
| **33** | Auto-Scaling | Aprovisionamiento Autónomo en Caliente y RBAC Segregado | [Warm Pool & Auto-escalado](../arquitectura-saas/warm-pool-autoscaling.md) |
| **34** | Plataforma | Verificación E2E de Auto-Escalado con Crossplane | [Warm Pool & Auto-escalado](../arquitectura-saas/warm-pool-autoscaling.md) |
| **35** | SRE & Ingress | Aprovisionamiento de Ingress-NGINX *(Reemplazado por ADR 36)* | [SRE & Observabilidad](../gitops-plataforma/sre-observabilidad.md) |
| **36** | Seguridad Perimetral | Deshabilitación Declarativa de Ingress HTTP y Port-Forwarding | [SRE & Observabilidad](../gitops-plataforma/sre-observabilidad.md) |
| **37** | Auto-Scaling | Declaración Formal de HPA (3 a 5), PDB y RollingUpdate | [Capacidad & Ley de Little](../arquitectura-saas/capacidad-sre-little.md) |
