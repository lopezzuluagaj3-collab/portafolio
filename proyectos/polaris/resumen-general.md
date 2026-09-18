---
sidebar_position: 1
title: Resumen General
---

# Polaris — Plataforma ETL sobre Kubernetes Self-Managed en AWS

## ¿Qué es Polaris?

Polaris es un proyecto de portafolio construido con el objetivo de aprender y demostrar dominio práctico de **Kubernetes, Helm y Cilium** en un entorno realista de datos. A diferencia de un tutorial aislado, Polaris resuelve un problema de datos real de principio a fin, sobre una infraestructura completa desplegada en AWS y administrada por mí mismo (self-managed), no sobre un servicio gestionado como EKS.

**Proyecto individual**, desarrollado en aproximadamente **dos semanas**, sin equipo — desde el diseño de la infraestructura hasta el pipeline ETL funcional de punta a punta.

## El problema

El punto de partida es un dataset público de Kaggle (Brazilian E-Commerce de Olist) con condiciones típicas de un entorno de datos real y no controlado:

- **Formatos erróneos**: columnas con tipos de datos inconsistentes entre archivos.
- **Datos incompletos**: valores nulos y registros parciales.
- **Datos desestructurados**: información que no sigue un esquema limpio y requiere transformación antes de ser analizable.

El objetivo fue diseñar un pipeline ETL capaz de ingerir, limpiar, transformar y modelar estos datos de forma automatizada y repetible, corriendo sobre una plataforma de orquestación robusta.

## Mi rol

Actué en un rol combinado de:

- **DevOps / DevSecOps**: diseño y automatización de la infraestructura, la plataforma de Kubernetes y la integración de controles de seguridad y calidad en cada pipeline de CI/CD.
- **Ingeniero de Datos**: diseño del modelo de datos, desarrollo de los scripts ETL y definición de los DAGs de orquestación en Airflow.

## Por qué K3s self-managed y no EKS

La decisión de operar Kubernetes yo mismo, en lugar de usar un servicio gestionado como EKS, fue deliberada por dos razones:

1. **Costo**: administrar el control plane directamente sobre EC2 evita el cargo fijo por clúster que cobra EKS, relevante para un proyecto de portafolio sin presupuesto de producción.
2. **Aprendizaje real**: operar K3s desde cero — bootstrap del control plane, unión de workers, instalación de CNI, gestión de storage — obliga a entender los fundamentos de Kubernetes que un servicio gestionado abstrae. Esa base hace que una migración futura a EKS sea mucho más eficaz, porque ya se entiende qué está pasando por debajo del servicio gestionado.

## Decisión de arquitectura: 3 repositorios

Polaris se distribuye deliberadamente en tres repositorios independientes, cada uno con una responsabilidad clara. Esta separación permite que cada componente tenga su propio ciclo de vida, su propio pipeline de CI/CD y sus propias validaciones de calidad, sin acoplar cambios de infraestructura con cambios de lógica de negocio.

| Capa | Responsabilidad | Repositorio |
|---|---|---|
| Infraestructura | VPC, subnets, EC2, IAM, EBS y arranque del clúster K3s | `polaris-infrastructure` |
| Plataforma | Kubernetes, Helm, networking, secretos y observabilidad | `polaris-kubernetes` |
| Aplicación de datos | Imagen Airflow, DAGs, extracción, transformación y carga | `polaris-airflow` |

Un detalle importante de diseño compartido por los tres repos: los **DAGs no forman parte de la imagen de Airflow**. Se definen en `polaris-airflow`, pero Kubernetes los toma en tiempo de ejecución mediante **Git-Sync**. Esto desacopla el ciclo de vida de la lógica de negocio del ciclo de vida de la imagen del orquestador — se puede actualizar un DAG sin reconstruir ni redesplegar Airflow completo.

## DevSecOps: seguridad y calidad desde el diseño

Los tres repositorios comparten una misma filosofía: ningún cambio llega al clúster sin pasar por controles automatizados de calidad y seguridad.

| Herramienta | Propósito |
|---|---|
| **Trivy** | Escaneo de vulnerabilidades en manifiestos de Kubernetes, imágenes de contenedor y dependencias |
| **Checkov** | Análisis estático de seguridad sobre el código de infraestructura (Terraform y manifiestos renderizados) |
| **SonarCloud** | Análisis de calidad de código |
| **Infracost** | Estimación de costo de la infraestructura definida en Terraform, en cada cambio |

## Resultado

El resultado es una **infraestructura funcional y completamente replicable**: el clúster completo (red, cómputo, plataforma de Kubernetes y pipeline de datos) puede destruirse y reconstruirse desde cero de forma automatizada, sin pasos manuales.

- **Costo estimado**: ~$414 USD/mes (reportado automáticamente por Infracost en cada cambio de infraestructura, sin intervención manual).
- **Tiempo de rebuild**: con los secretos y variables de entorno ya preparados, el ciclo completo de levantar la infraestructura toma aproximadamente **20 a 30 minutos**.

En las siguientes secciones se detallan las decisiones técnicas de cada repositorio, los trade-offs considerados y las lecciones aprendidas durante la construcción del proyecto.
