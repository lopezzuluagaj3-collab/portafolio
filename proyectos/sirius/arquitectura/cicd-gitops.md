---
sidebar_position: 2
title: CI/CD, GitOps & DevSecOps
---

# CI/CD, GitOps con OIDC y Seguridad DevSecOps

## Pipeline Automatizado con GitHub Actions

La infraestructura de AWS se gestiona al 100% como código declarativo mediante **Terraform 1.11**, siguiendo el principio de GitOps donde el repositorio es la única fuente de la verdad (*single source of truth*).

### Autenticación Sin Credenciales Estáticas (OpenID Connect - OIDC)

Para mitigar el riesgo de filtración de llaves de acceso de larga duración (`AWS_ACCESS_KEY_ID`), GitHub Actions asume temporalmente el rol IAM **`terraform-sirius`** mediante federación OIDC:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": ["sts:AssumeRoleWithWebIdentity", "sts:TagSession"],
      "Condition": {
        "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
        "StringLike": { "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:*" }
      }
    }
  ]
}
```

### Matriz de Controles DevSecOps en Pull Requests

Cada Pull Request hacia la rama principal ejecuta secuencialmente 5 etapas de validación automática:

| Herramienta | Capa Evaluada | Propósito del Quality Gate |
| :--- | :--- | :--- |
| **`terraform fmt`** | Formato HCL | Garantiza consistencia estilística y limpieza de código. |
| **TFLint** | Sintaxis IaC | Detecta errores de configuración de providers y variables no declaradas. |
| **Checkov** | Seguridad Cloud | Escanea más de 200 políticas de seguridad CIS Benchmark en recursos de AWS. |
| **SonarCloud** | Calidad de Código | Analiza mantenibilidad, duplicación y deuda técnica de scripts Python. |
| **Infracost** | FinOps Shift-Left | Calcula la variación proyectada del costo mensual de AWS y comenta la tabla en el PR. |

### Aislamiento de Estado Remoto (Terraform Backend)
El estado de Terraform se almacena en el bucket S3 `sirius-tfstate-...` con:
- Cifrado en reposo SSE-S3 forzado.
- Versionado de objetos habilitado para recuperación ante corrupción de estado.
- Bloqueo público total (*Block Public Access*).
- Política de bucket restrictiva que solo permite operaciones de lectura y escritura al ARN del rol `terraform-sirius`.
