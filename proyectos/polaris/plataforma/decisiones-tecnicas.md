---
sidebar_position: 2
title: Decisiones Técnicas
---

# Plataforma — Decisiones Técnicas

## Kubernetes autoadministrado (K3s) en vez de EKS

Se usa Kubernetes sobre AWS sin EKS, deliberadamente, por dos razones: **ahorro de costos** (sin el cargo fijo de control plane gestionado) y **aprendizaje real** de los fundamentos de Kubernetes — bootstrap del control plane y workers, CNI, acceso al API server, ingress, almacenamiento y despliegue de componentes. Tener esta base sólida hace que una eventual migración a EKS sea mucho más eficaz, porque ya se entiende qué hace el control plane gestionado por debajo.

## Helm con valores separados del chart

Los charts upstream (Bitnami, Apache Airflow, Prometheus Community, Jetstack, ingress-nginx) se consumen desde sus repositorios oficiales, y las personalizaciones del proyecto viven exclusivamente en `charts/*/values.yaml`. Esto conserva la mantenibilidad del software de terceros y permite revisar las decisiones específicas de Polaris sin copiar charts completos ni bifurcar su código.

El pipeline también descarga los charts, ejecuta `helm lint` y genera manifiestos en `rendered/`. Escanear ese resultado renderizado es importante: es la configuración real que recibirá el clúster, no solo el archivo de valores — un `values.yaml` correcto puede aun así generar un manifiesto inseguro dependiendo de cómo lo interprete el chart.

## Git-Sync para desacoplar DAGs de la imagen

Ya mencionado en el resumen general, pero vale profundizar el trade-off: sin Git-Sync, cada cambio de lógica de negocio (un DAG) requeriría reconstruir y republicar la imagen completa de Airflow, con el downtime y la complejidad de despliegue que eso implica. Con Git-Sync, el pod de Airflow sincroniza los DAGs desde el repositorio cada ~30 segundos, sin reinicios de pods.

## Airflow desplegado sin `--wait`

Una decisión intencional: Airflow se despliega sin la bandera `--wait` de Helm. Su job de migración de base de datos se ejecuta como un hook, y los pods de Airflow esperan a que ese hook termine antes de arrancar. Si el pipeline esperara la disponibilidad completa de Airflow *antes* de ejecutar el hook de migración, se produciría un bloqueo circular (Airflow nunca está "disponible" hasta que la migración corre, pero el `--wait` esperaría disponibilidad primero). El workflow verifica el estado de la migración y de cada componente *después* del despliegue, evitando ese problema.

## Almacenamiento persistente vía EBS CSI

PostgreSQL, RabbitMQ y la observabilidad usan la StorageClass `ebs-sc` en vez de almacenamiento local (`local-path`), lo que permite que los pods de estado se puedan reprogramar a otro nodo sin perder sus datos — un requisito básico para cualquier plataforma que se tome en serio la persistencia, aunque el clúster sea de un solo control plane.
