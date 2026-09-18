---
sidebar_position: 4
title: CI/CD y Operación
---

# Aplicación de Datos — CI/CD y Operación en Kubernetes

## Seguridad y DevSecOps en este repositorio

- **Dependencias y secretos**: las credenciales de Kaggle y PostgreSQL se reciben por variables de entorno o Kubernetes Secrets; `.env` está excluido de git.
- **Imagen mínima**: el Dockerfile instala dependencias sin caché y cambia a UID 50000 después de las operaciones de instalación (no corre como root).
- **Hadolint**: revisa prácticas inseguras o problemáticas del propio Dockerfile.
- **Trivy**: escanea la imagen construida y bloquea vulnerabilidades `CRITICAL` y `HIGH`, ignorando únicamente las documentadas explícitamente en `.trivyignore`.
- **SonarCloud**: analiza el código ETL y recibe el reporte de cobertura generado por pytest.
- **Acciones fijadas por SHA**: las GitHub Actions del workflow se referencian por SHA, no por tag, reduciendo el riesgo de cambios inesperados en dependencias de CI.
- **SQL parametrizado**: la carga usa `psycopg2.sql` para identificadores y `execute_values` para insertar por lotes, evitando inyección SQL incluso en nombres dinámicos de tabla/columna.

## Contrato entre repositorios

Este repositorio documenta y respeta un contrato claro con `polaris-kubernetes`:

1. `polaris-kubernetes` recibe el evento `deploy-airflow` con `image_tag` igual al SHA del commit.
2. Helm actualiza el workload para usar esa imagen exacta.
3. Kubernetes monta los volúmenes personalizados para datos, resultados y configuración persistente.
4. Git-Sync clona el repositorio de DAGs y sincroniza cambios aproximadamente cada 30 segundos.
5. Airflow carga los DAGs desde el volumen sincronizado y ejecuta las tareas en los workers configurados.
6. Las tareas escriben los CSV intermedios en el volumen de datos y cargan el resultado en PostgreSQL.

## Limitaciones conocidas (documentadas a propósito)

- El DAG usa `schedule=None`; la ejecución programada real debe definirse explícitamente en la capa de orquestación.
- La extracción valida nueve archivos esperados, mientras la transformación utiliza ocho tablas CSV — el archivo de geolocalización se conserva como insumo esperado, pero aún no participa en el modelo analítico.
- La cobertura de pruebas es principalmente unitaria y de integración local; no reemplaza pruebas contra un PostgreSQL real o un despliegue completo en clúster.
- Las excepciones de `.trivyignore` requieren revisión periódica al actualizar la imagen base y las dependencias.

Documentar estas limitaciones de forma explícita es una decisión deliberada: evita presentar el proyecto como una plataforma productiva completamente terminada, y dejar claro qué decisiones quedan pendientes es tan valioso como documentar lo que ya funciona.
