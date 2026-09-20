---
sidebar_position: 1
title: Athena Data Marts & CTAS
---

# Amazon Athena, Partition Projection y Data Marts (Gold)

## Partition Projection: Consultas Inmediatas sin Crawlers

En lugar de depender de AWS Glue Crawlers o sentencias `MSCK REPAIR TABLE` que tardan minutos recorriendo miles de prefijos en S3 y generan costos de llamadas a las APIs de AWS, se implementó **Partition Projection** configurada directamente en Terraform:

```hcl
table_properties = {
  "projection.enabled"       = "true"
  "projection.anio.type"     = "integer"
  "projection.anio.range"    = "2009,2026"
  "projection.mes.type"      = "integer"
  "projection.mes.range"     = "1,12"
  "projection.mes.digits"    = "2"
  "storage.location.template" = "s3://${aws_s3_bucket.staging.id}/staging/taxi/tipo_taxi=$${tipo_taxi}/anio=$${anio}/mes=$${mes}/"
}
```

**Resultado:** Athena calcula las ubicaciones de particiones en memoria instantáneamente. Los tiempos de respuesta se redujeron a **2.0 – 3.4 segundos**, escaneando solo los bytes necesarios.

---

## Los 4 Data Marts Estratégicos (Capa Gold)

Mediante sentencias **CTAS (Create Table As Select)** desacopladas en scripts SQL parametrizados, se redujo el volumen analítico de **123.2 GB a 388.8 MB (99.7% de reducción)**:

| Data Mart | Pregunta de Negocio Estratégica | Filas Gold | Tiempo CTAS | S3 Path |
| :--- | :--- | :--- | :--- | :--- |
| **`mart_cuota_mercado_mensual`** | ¿Cómo evolucionó la cuota de mercado entre Yellow, Green, FHV y Apps (2009-2026)? | **591** | **6.3 s** | `s3://.../mart/mart_cuota_mercado_mensual/` |
| **`mart_kpis_financieros`** | ¿Cómo se comportan las tarifas, propinas, peajes, recargos y pago a conductores? | **453** | **15.6 s** | `s3://.../mart/mart_kpis_financieros/` |
| **`mart_demanda_territorial`** | ¿Cuáles son los corredores de movilidad más transitados entre distritos de NYC? | **1,370,940** | **28.0 s** | `s3://.../mart/mart_demanda_territorial/` |
| **`mart_patrones_temporales`** | ¿Cómo se distribuyen los viajes a lo largo de las 24 horas y los 7 días de la semana? | **6,552** | **15.6 s** | `s3://.../mart/mart_patrones_temporales/` |

---

## Desacople: Disaster Recovery vs Carga Incremental

Para cumplir el principio de *"prepararse para lo peor"* y optimizar los costos de operación mensual, se diseñaron dos scripts independientes:

1. **Reconstrucción Completa (`scripts/materializar_marts.py`):**
   - Ejecuta `DROP TABLE` + `CTAS` para recrear las tablas Gold completas desde cero para los 18 años históricos.
   - Ideal para recuperarse de desastres, cambios de estructura o redefinición de KPIs.
2. **Carga Incremental (`scripts/incremental_marts.py`):**
   - Ejecuta `INSERT INTO` filtrado por partición específica (`--anio YYYY --mes MM`).
   - Posee **guardia de idempotencia**: si el periodo ya existe en el Mart, detiene la operación para prevenir duplicación accidental de datos.
   - Escanea solo los megabytes del nuevo mes en Staging en 2 a 3 segundos con costo inferior a \$0.001 USD.
