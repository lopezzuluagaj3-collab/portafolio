# 3. Guía de Bootstrap, Runbooks Operativos y FinOps

Este documento reúne los runbooks reproducibles en **PowerShell** para aprovisionar, verificar y operar el clúster de **Azure Kubernetes Service (AKS)**, el backend de **Terraform**, la identidad federada **OIDC**, los secretos de Kubernetes y los procedimientos de optimización financiera (**FinOps**) para parada y reactivación sin costo de cómputo inactivo.

---

## 🛠️ Procedimientos de FinOps (Apagado y Encendido de Clúster)

Para optimizar costos durante períodos de inactividad o fuera del horario laboral, el clúster AKS se apaga de forma segura desasignando las máquinas virtuales (`Standard_D2s_v7`), lo que reduce a cero el costo de cómputo preservando intactos los discos administrados (`managed-csi`) y las configuraciones.

### Procedimiento de Apagado (Stop)
> [!WARNING]
> **Bloqueo por Webhook de Crossplane en AKS:** Crossplane instala un webhook mutador/validador (`crossplane-no-usages`) con reglas globales (`apiGroups: ['*']`, `resources: ['*']`). Azure AKS bloquea preventivamente el comando `az aks stop` si detecta este webhook para evitar que el plano de control se congele durante el encendido previo al arranque de los pods de Crossplane.
> **Mitigación Operacional:** Eliminar el webhook antes de ordenar el apagado:
> ```powershell
> kubectl delete validatingwebhookconfiguration crossplane-no-usages
> az aks stop --name aks-pleyades-dev --resource-group rg-pleyades-dev
> ```

### Procedimiento de Encendido (Start)
Para reanudar las operaciones:
```powershell
az aks start --name aks-pleyades-dev --resource-group rg-pleyades-dev
```
*Tarda entre 2 y 3 minutos en reasignar los nodos y levantar los pods de plataforma (`ArgoCD`, `Cilium`, `Crossplane`, `kube-prometheus-stack`) a estado `1/1 Running`. La persistencia y conectividad se restablecen automáticamente reconectando a la instancia gestionada Azure PostgreSQL Flexible Server (`psql-pleyades-dev-01`, ADR 30), permaneciendo el StatefulSet in-cluster `database/postgres-0` escalado a 0 réplicas.*

---

## 📋 Resumen del Runbook de 10 Pasos para Bootstrap Completo

| Paso | Módulo / Componente | Acción Principal | Script / Comando |
| :--- | :--- | :--- | :--- |
| **Paso 1** | Parámetros Globales | Definición de variables de entorno de Azure y GitHub. | Ver [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **Paso 2** | Backend Terraform | Creación de Storage Account con Blob Leases para state locking. | Ver [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **Paso 3** | Cloud IAM | Aprovisionamiento de Managed Identity (UAMI) para OIDC. | Ver [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **Paso 4** | Seguridad GitHub | Creación de Federated Identity Credentials para PRs y Main. | Ver [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **Paso 5** | Azure RBAC | Asignación de roles Contributor y Storage Blob Data Contributor. | Ver [Arquitectura IaC](../infraestructura/arquitectura-iac.md) |
| **Paso 6** | CI/CD Secrets | Inyección de OIDC Secrets y Personal Access Token en GitHub. | Ver [ArgoCD & Crossplane](../gitops-plataforma/argocd-crossplane.md) |
| **Paso 7** | Kubernetes Secrets | Inyección de credenciales en AKS (`pleyades-app-secret`). | Ver [ArgoCD & Crossplane](../gitops-plataforma/argocd-crossplane.md) |
| **Paso 8** | Microservicio Go | Ejecución local de BD, API REST, JWT y creación de tenants. | Ver [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **Paso 9** | Calidad & Cobertura | Ejecución de suite unitaria en memoria con perfiles de cobertura. | Ver [Arquitectura Hexagonal Go](../arquitectura-saas/arquitectura-hexagonal-go.md) |
| **Paso 10** | Pruebas k6 SRE | Despliegue de k6 Job in-cluster en AKS y benchmarks locales. | Ver [SRE & Observabilidad](../gitops-plataforma/sre-observabilidad.md) |
