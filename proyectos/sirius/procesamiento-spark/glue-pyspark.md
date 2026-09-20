---
sidebar_position: 1
title: AWS Glue 4.0 & PySpark Tuning
---

# AWS Glue 4.0 PySpark y Saturación Multihilo

## Desafío: Subutilización del Clúster Spark en Ingesta Masiva

Durante la fase inicial del backfill histórico de 18 años, el procesamiento secuencial mes a mes de los archivos Parquet provocaba un cuello de botella severo:
- Cada archivo mensual se leía y escribía en secuencia, tardando aproximadamente **2.8 minutos por archivo**.
- En un clúster de **60 Workers Glue G.1X (240 cores y 960 GB RAM)**, el clúster pasaba la mayor parte del tiempo con el 95% de los cores ociosos esperando I/O de lectura y planificación del driver.
- A ese ritmo, el backfill de 590 archivos habría tardado más de **27 horas continuas de clúster**, consumiendo todo el presupuesto de créditos de AWS.

## Solución: Multithreading en el Driver (`ThreadPoolExecutor`)

Para saturar eficientemente los ejecutores distribuidos de Spark, se implementó paralelismo a nivel del driver de Glue usando `concurrent.futures.ThreadPoolExecutor`:

```python
from concurrent.futures import ThreadPoolExecutor

# Saturación del clúster procesando 4 particiones mensuales en paralelo
with ThreadPoolExecutor(max_workers=4) as executor:
    futures = [executor.submit(procesar_mes_spark, mes_path) for mes_path in lista_meses]
    for future in futures:
        future.result()
```

### Resultados de la Optimización:
- **Tiempo por mes:** Reducido de 2.8 minutos a solo **~50 segundos**.
- **Tiempo total del backfill:** De 27 horas estimadas a **~4.4 horas acumuladas de clúster**.
- **Rendimiento:** Escalamiento a más de **875,000 registros procesados por segundo**.

---

## Tabla de Rendimiento por Formato (Backfill 2009 - 2026)

| Formato TLC | Periodo Procesado | Registros Limpios | Capacidad Clúster | Tiempo de Procesamiento | Throughput Promedio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Green Taxi** | 151 meses (2014 – 2026) | **84,189,399** | 15 Workers G.1X | **~20 minutos** (1,197s) | ~70,000 filas/seg |
| **Yellow Taxi** | 211 meses (2009 – 2026) | **~1,900,000,000** | 60 Workers G.1X (4 hilos) | **~55 minutos** (3,333s) | ~120,000 filas/seg |
| **FHVHV (Uber/Lyft)** | 90 meses (2019 – 2026) | **~1,630,000,000** | 60 Workers G.1X (4 hilos) | **~67 minutos** (4,017s) | ~405,000 filas/seg |
| **FHV (Bases Livery)**| 138 meses (2015 – 2026) | **~810,000,000** | 60 Workers G.1X (4 hilos) | **~15.4 minutos** (926s) | ~875,000 filas/seg |
| **TOTAL PIPELINE** | **590 Parquets (18 Años)** | **~4,424,000,000 viajes** | **Clúster Dinámico** | **~4.4 horas acumuladas** | **Escala Big Data** |

---

## Particionado y Compresión en Capa Staging

La salida de Glue se almacena en el bucket `s3://sirius-staging-.../staging/`:
- **Formato:** Apache Parquet optimizado con compresión **Snappy**.
- **Particionado Hive:** `tipo_taxi={yellow|green}/anio=YYYY/mes=MM/`.
- **Deduplicación:** Aplicación de `dropDuplicates(['vendor_id', 'pickup_datetime', 'dropoff_datetime', 'pulocationid', 'dolocationid'])`.
- **Tamaño total resultante:** **123.2 GB** limpios y normalizados.
