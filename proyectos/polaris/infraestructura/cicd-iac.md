---
sidebar_position: 3
title: CI/CD e IaC
---

# Infraestructura — CI/CD e Infraestructura como Código

## Patrón plan-and-apply con aprobación manual

El pipeline de GitHub Actions de este repositorio sigue un flujo de **plan-and-apply**: cada push o PR a `main` ejecuta validación y genera un plan de Terraform; el `apply` real requiere aprobación manual mediante GitHub Environments, reutilizando el artifact del plan ya generado (nunca se re-planifica antes de aplicar).

| Etapa | Herramienta | Propósito |
|---|---|---|
| Auth | `aws-actions/configure-aws-credentials` | Federación **OIDC** — sin credenciales de larga duración |
| Lint | TFLint | Linting de Terraform |
| Validate | `terraform validate` | Validación de sintaxis |
| Security | Checkov | Escaneo de seguridad de IaC |
| Costos | **Infracost** | Estimación de costo, comentada en PRs |
| Calidad | SonarCloud | Quality gate de código |
| Plan | `terraform plan` | Generar plan de ejecución |
| Notificar | Email | Reporte completo por correo |
| Apply | `terraform apply` (con aprobación manual) | Aplicar el plan ya generado |

## Autenticación OIDC — sin credenciales de larga duración

El pipeline de infraestructura no almacena una Access Key de AWS de larga duración como secreto de GitHub. En su lugar, usa un **proveedor OIDC** de GitHub Actions con un rol IAM que confía específicamente en el repositorio `polaris-infrastructure`, reduciendo la superficie de exposición frente a un secreto estático que pudiera filtrarse.

## Infracost: costo como parte del ciclo de entrega

Cada cambio de infraestructura se escanea automáticamente con Infracost, y el resultado se envía como reporte por correo antes del despliegue — dando visibilidad financiera continua sin intervención manual. El clúster completo de Polaris tiene un costo estimado de **~$414 USD/mes**, desglosado principalmente en:

- 6 instancias `c7i-flex.large` (cómputo, la mayor parte del costo).
- 1 NAT Gateway (costo fijo + procesamiento de datos).
- Almacenamiento EBS (gp3) por instancia.

## Checkov y TFLint: calidad y seguridad de la IaC

- **TFLint** valida buenas prácticas y errores comunes de sintaxis/uso en Terraform antes de siquiera generar un plan.
- **Checkov** escanea el código de Terraform en busca de configuraciones inseguras (por ejemplo, security groups demasiado permisivos, falta de encriptación, IMDSv1 habilitado) — todas las instancias del clúster fuerzan **IMDSv2** como resultado directo de este control.

## Estado remoto de Terraform

El estado se guarda en un bucket S3 dedicado, con encriptación AES-256, gestionado fuera del ciclo de vida de Terraform (el bucket no se crea ni se destruye por Terraform, evitando el riesgo de perder el estado en un `destroy` accidental).
