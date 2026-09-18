---
sidebar_position: 4
title: CI/CD y Despliegue
---

# Plataforma — CI/CD y Despliegue

## Secuencia del pipeline

```
YAMLLint
  -> Helm lint + render + Checkov
  -> Trivy + SonarCloud
  -> Deploy en runner self-hosted
  -> Verificación de rollouts y certificados
```

Los cambios en `main` activan el flujo completo cuando afectan charts, ingress, namespaces o el propio workflow. Los Pull Requests ejecutan únicamente las validaciones (sin desplegar). El despliegue real requiere un push a `main` o un `repository_dispatch` de tipo `deploy-airflow` — este último es el mecanismo que usa `polaris-airflow` para disparar un redeploy tras publicar una imagen nueva.

El job de despliegue corre en el **runner self-hosted** (con conectividad directa al API server del clúster) y está protegido por el environment `production` de GitHub.

## Secuencia de despliegue con Helm

1. Crear o verificar los namespaces.
2. Instalar `cert-manager` y aplicar el `ClusterIssuer`.
3. Instalar `ingress-nginx`.
4. Instalar `kube-prometheus-stack`.
5. Instalar PostgreSQL y RabbitMQ en el namespace `data`.
6. Instalar o actualizar Airflow en el namespace `airflow`.
7. Aplicar el Ingress de Grafana.
8. Esperar la migración de Airflow y verificar los rollouts.

Todas las operaciones usan `helm upgrade --install`, lo que hace el despliegue idempotente: correr el pipeline dos veces con los mismos valores no produce cambios adicionales.

## Versionado de charts

El pipeline fija versiones explícitas para Airflow, PostgreSQL y RabbitMQ — un `helm upgrade` sin versión fijada podría cambiar `volumeClaimTemplates` (un campo inmutable de StatefulSet) y forzar la recreación del PVC, con pérdida de datos. Esta es una de las lecciones más costosas del proyecto: le pasó dos veces a la base de datos de Postgres antes de fijar versiones en todos los charts críticos.

## Verificación post-despliegue

```bash
kubectl get pods -A
kubectl get ingress -A
kubectl get certificate -A
```

Los reportes de Checkov, SonarCloud y el resultado del análisis se conservan como artefactos del pipeline o se envían por correo a la dirección configurada en los secretos del repositorio.
