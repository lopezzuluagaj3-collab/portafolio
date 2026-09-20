---
sidebar_position: 2
title: FinOps & Auditoría de Costos
---

# FinOps: Auditoría Real y Eficiencia de Costos en AWS

## Análisis del Costo Inicial (Backfill de 18 Años)

Procesar 4,424 millones de registros con Spark distribuido requirió un estricto control de gasto y observabilidad financiera:

- **Métricas Reales del Clúster Glue:**
  - 18 ejecuciones de Glue Job completadas exitosamente.
  - Consumo acumulado: **755,184 DPU-segundos** (equivalente a **209.77 DPU-horas** de Spark).
  - Tarifa AWS Glue en `us-east-1`: \$0.44 USD por DPU-hora.
  - Costo bruto de computación Spark: **\$92.30 USD**.
- **Costo de Consultas Athena (CTAS y QA):** **\$0.60 USD** (~120 GB escaneados a \$5.00/TB).
- **Costo de Almacenamiento S3 (Mes de Carga):** **\$0.26 USD**.
- **Financiamiento Inteligente:** 100% cubierto con créditos promocionales de AWS (\$120.00 iniciales $\rightarrow$ Saldo remanente de **\$33.31 USD**). **Costo de bolsillo: \$0.00 USD**.

---

## Costo Mensual Recurrente en Régimen Permanente (Mantenimiento)

Completado el backfill, la infraestructura se escaló hacia abajo automáticamente: el Glue Job pasó de **60 workers a solo 2 workers G.1X** (`number_of_workers = 2`, `timeout = 60`):

| Servicio AWS | Dimensionamiento Mensual en Mantenimiento | Costo Mensual Proyectado |
| :--- | :--- | :--- |
| **AWS Glue (PySpark)** | 1 corrida mensual (~4 archivos nuevos, ~3 min con 2 workers = 0.1 DPU-h) | **\$0.04 USD** |
| **AWS Lambda** | Invocaciones mensuales de detección y descarga (~5 ejecuciones) | **\$0.00 USD** (Capa Gratuita) |
| **Amazon SQS + DLQ** | Menos de 100 mensajes al mes | **\$0.00 USD** (Capa Gratuita) |
| **Amazon EventBridge** | 1 disparo programado al mes | **\$0.00 USD** (Capa Gratuita) |
| **Amazon Athena** | Ejecución de inserción incremental de marts (~2 GB escaneados) | **\$0.01 USD** |
| **Amazon S3 Storage** | ~200 GB totales (Row + Staging + Mart) en clase Standard | **\$4.60 USD** |
| **TOTAL MENSUAL RECURRENTE** | **Operación 100% Desatendida** | **~\$4.65 USD / mes** |

---

## Lecciones FinOps Aprendidas

1. **Retardo de Facturación en AWS Console:** Los widgets del AWS Billing Dashboard presentan un retraso de 24 a 48 horas en consolidar el gasto de Glue, mientras que el saldo de créditos se descuenta en tiempo real. La observabilidad precisa de DPU-segundos en CloudWatch es la métrica clave para auditorías en vivo.
2. **Escalado Justo a Tiempo:** Mantener clústeres sobredimensionados tras finalizar cargas pesadas es el error FinOps más común. El escalamiento declarativo con Terraform a 2 workers garantiza costos insignificantes en régimen permanente.
