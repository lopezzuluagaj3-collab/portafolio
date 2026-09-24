---
sidebar_position: 1
title: Resumen General
---

# Sirius — Modern Data Lakehouse Serverless en AWS (NYC TLC)

## ¿Qué es el Proyecto Sirius?

**Sirius** es un Modern Data Lakehouse Serverless diseñado, aprovisionado y operado sobre **Amazon Web Services (AWS)** con **Terraform**, para procesar y analizar el histórico completo de viajes de la **Comisión de Taxis y Limusinas de la Ciudad de Nueva York (NYC TLC)**.

El sistema ingesta, limpia, estandariza y materializa más de **18 años de datos (2009 – 2026)** que abarcan **~4,424 Millones de registros (75.1 GB crudos en 590 archivos Parquet)**, transformándolos mediante **Apache Spark en AWS Glue 4.0** hacia una arquitectura Medallion (**Row, Staging y Mart**) consumible en sub-segundos por **Power BI**.

**Proyecto individual**, desarrollado de punta a punta: desde la Infraestructura como Código (IaC), GitOps OIDC, optimización de shuffles distribuido en PySpark, hasta el modelado dimensional y diseño de tableros de Business Intelligence.

---

## La Problemática de Negocio y Técnica

El dataset de NYC TLC es uno de los mayores benchmarks mundiales de transporte público, presentando complejidades de ingeniería de datos a escala masiva:

1. **Deriva Severa de Esquemas (*Schema Drift*):** Tipos de datos mutando mes a mes a lo largo de 18 años (ej. `rate_code` o `vendor_id` alternando entre cadenas, flotantes y enteros), que quiebran pipelines de lectura tradicionales.
2. **Heterogeneidad de Servicios:** Coexistencia de 4 formatos incompatibles: **Yellow Taxi**, **Green Taxi**, **FHV** (limusinas/bases tradicionales) y **FHVHV** (apps de alta densidad: Uber, Lyft, Via).
3. **Anomalías y Datos Corruptos:** Registros con fechas invertidas, duraciones negativas, tarifas en cero por reembolsos, y cambio histórico de coordenadas GPS a 265 Zonas TLC.
4. **Disrupción Histórica:** Desplazamiento progresivo del taxi amarillo por las apps de movilidad (absorbiendo más del 80% del mercado tras 2019) e impacto del COVID-19 en 2020.

---

## Mi Rol

Desempeñé un rol integral de **Lead Cloud Data & DevOps Engineer**:

- **DevOps / Platform Engineer:** Arquitectura Serverless como Código con Terraform (Remote Backend en S3 con DynamoDB State Locking), pipeline CI/CD en GitHub Actions autenticado vía OpenID Connect (OIDC) sin credenciales permanentes, escaneo estático de seguridad con Checkov, análisis de código con SonarCloud y auditoría de costos con Infracost.
- **Data Engineer:** Optimización del clúster Glue PySpark con multithreading (`ThreadPoolExecutor`), diseño de casting universal (*Safe Cast*), particionado eficiente Snappy Parquet y diseño de consultas analíticas CTAS en Amazon Athena con Partition Projection.
- **BI / Analytics Engineer:** Integración de Power BI Desktop mediante ODBC DSN bajo el principio de mínimo privilegio IAM, modelado relacional y construcción de dashboards ejecutivos.

---

## Arquitectura Medallion en AWS

```mermaid
flowchart LR
    CDN["NYC TLC CDN"] -->|"Trigger Mensual"| LAMBDA["AWS Lambda + SQS"]
    LAMBDA -->|"Parquet Crudo (75.1 GB)"| S3_ROW["S3 Row Bucket"]
    S3_ROW -->|"PySpark 4.0 (Multithread)"| GLUE["AWS Glue Job"]
    GLUE -->|"Snappy Parquet (123.2 GB)"| S3_STG["S3 Staging Bucket"]
    S3_STG -->|"Partition Projection"| ATHENA["Amazon Athena v3"]
    ATHENA -->|"CTAS Agregados (388.8 MB)"| S3_MART["S3 Mart Bucket"]
    S3_MART -->|"Simba ODBC (IAM Reader)"| PBI["Power BI Desktop"]
```

| Capa | Almacenamiento | Tecnología | Propósito |
| :--- | :--- | :--- | :--- |
| **Row (Bronze)** | `75.1 GB` (590 Parquets) | S3 + Lambda Streaming | Almacenamiento inmutable del dato fuente crudo |
| **Staging (Silver)** | `123.2 GB` (Snappy) | AWS Glue 4.0 (PySpark) | Limpieza, deduplicación, tipado seguro y unificación |
| **Mart (Gold)** | `388.8 MB` (4 Marts) | Athena CTAS + Partition Projection | Agregaciones analíticas para BI (reducción del 99.7%) |

---

## Métricas y Resultados Clave

- **Registros procesados:** **~4,424,000,000 viajes** en 4.4 horas acumuladas de clúster.
- **Throughput pico:** **~875,000 filas por segundo** alcanzadas en el formato FHV.
- **Reducción analítica:** De 123.2 GB a **388.8 MB (99.7% de ahorro en escaneo)**.
- **Tiempos de consulta en Athena:** **2.0 a 3.4 segundos** sobre billones de filas gracias a Partition Projection.
- **FinOps Auditado:**
  - **Costo del Backfill (18 años):** **\$92.30 USD** de cómputo Spark (100% absorbido por créditos AWS).
  - **Costo Mensual de Mantenimiento:** **~\$4.65 USD / mes** con el clúster escalado a 2 workers G.1X.
