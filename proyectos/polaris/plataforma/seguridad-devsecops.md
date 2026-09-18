---
sidebar_position: 3
title: Seguridad y DevSecOps
---

# Plataforma — Seguridad y DevSecOps

La seguridad se trata como una condición del ciclo de entrega, no como una revisión posterior al despliegue.

## Controles automatizados en el pipeline

- **YAMLLint**: sintaxis y estilo de charts, ingress y namespaces.
- **Helm lint**: validación de los charts upstream con los valores del proyecto.
- **Render reproducible**: generación de manifiestos en `rendered/` para inspección y escaneo.
- **Checkov**: controles de seguridad sobre los recursos de Kubernetes ya renderizados.
- **Trivy**: detección de configuraciones críticas y altas en los manifiestos.
- **SonarCloud**: análisis estático y consulta del Quality Gate.

La entrega se detiene si Trivy encuentra configuraciones `CRITICAL` o `HIGH`. Checkov mantiene `soft_fail: true`, permitiendo revisar sus hallazgos como evidencia del pipeline sin bloquear automáticamente cada advertencia — un balance consciente entre rigor y velocidad de iteración en un proyecto de portafolio.

## Gestión de secretos

Contraseñas, claves Fernet, claves API y cadenas de conexión se consumen desde **Kubernetes Secrets** ya existentes en el clúster — nunca se versionan en git ni se incluyen valores de ejemplo con credenciales reales en el repositorio. La creación de estos secretos es un paso manual y explícito, documentado aparte, antes del primer despliegue.

## Hardening de pods

Donde el chart lo permite, los pods se ejecutan:

- Como **usuario no root**.
- Con `seccompProfile: RuntimeDefault`.
- Con **capabilities eliminadas** y **restricción de privilege escalation**.

## TLS automático

`cert-manager` gestiona certificados de Let's Encrypt mediante desafíos HTTP-01, renovándolos automáticamente sin intervención manual.

## Excepciones documentadas, no silenciosas

Las excepciones de Trivy se documentan explícitamente en `docs/trivy-ignore.yaml`, limitadas a comportamientos requeridos por charts upstream (por ejemplo, componentes de cert-manager e ingress-nginx que necesitan privilegios específicos para funcionar). Una excepción **no se considera una aprobación silenciosa**: conserva su justificación por escrito y se revisa cada vez que el chart correspondiente se actualiza.
