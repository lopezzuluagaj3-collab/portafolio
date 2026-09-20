---
sidebar_position: 1
title: Ingesta Serverless Desacoplada
---

# Ingesta Serverless y Streaming a S3 Row

## Arquitectura de Extracción Reactiva

La ingesta automática de los datos públicos de NYC TLC se diseñó bajo un patrón **asíncrono desacoplado** para soportar descargas pesadas sin saturar memoria ni exceder límites de tiempo de ejecución de Lambda:

```
[EventBridge Cron] ──► [Lambda Detectora (HEAD HTTP)]
                               │ (Periodos faltantes)
                               ▼
                        [Amazon SQS + DLQ]
                               │ (Batch Size = 1)
                               ▼
                       [Lambda Descarga]
                               │ (HTTP Stream)
                               ▼
                    [S3 Row: 75.1 GB Crudos]
```

### Componentes de la Solución:

1. **Amazon EventBridge Rule:** Regla programada con expresión cron mensual que dispara el escaneo periódico de nuevas publicaciones.
2. **AWS Lambda Detectora:**
   - Realiza consultas HTTP `HEAD` ultraligeras contra el CDN de CloudFront de NYC TLC para verificar la existencia de archivos del nuevo periodo.
   - Contrasta los archivos publicados contra las particiones existentes en `s3://sirius-row-.../row/<formato>/anio=YYYY/mes=MM/`.
   - Si detecta meses ausentes en el Data Lake, envía mensajes JSON a la cola SQS con los metadatos requeridos: `{ "formato": "yellow", "anio": "2026", "mes": "03", "url": "..." }`.
3. **Amazon SQS + Dead Letter Queue (DLQ):**
   - Garantiza aislamiento y tolerancia a fallos. Si la CDN de TLC experimenta caídas o estrangulamiento (*throttling*), la cola retiene los mensajes con backoff exponencial.
   - Tras 3 reintentos fallidos, los mensajes son redirigidos a la DLQ para inspección sin detener el flujo general.
4. **AWS Lambda Descarga (Streaming en Memoria):**
   - Configurada con `batch_size = 1` y concurrencia controlada para evitar bloqueos por rate limiting.
   - Consume el mensaje de SQS y transmite el archivo Parquet directamente hacia S3 mediante streaming de buffers en chunks sin escribir a disco efímero local, optimizando el uso de RAM.
5. **Capa Row en Amazon S3:**
   - Almacena 590 archivos Parquet crudos (**75.1 GB**) organizados bajo prefijos de particionado Hive: `row/<tipo>/anio=YYYY/mes=MM/`.
