---
sidebar_position: 2
title: Pipeline de Datos
---

# Aplicación de Datos — Pipeline ETL

El DAG `olist_etl_pipeline` define una ejecución manual (`schedule=None`) y evita ejecuciones históricas con `catchup=False`. La secuencia es lineal para garantizar que cada etapa consuma el resultado completo de la anterior.

## 1. Extracción

`etl/extract/kaggle_downloader.py` descarga el dataset `olistbr/brazilian-ecommerce` mediante la CLI de Kaggle. Antes de descargar, comprueba si los archivos requeridos ya existen en el directorio de datos, evitando trabajo y tráfico innecesario en reejecuciones.

## 2. Transformación

`etl/transform/clean_orders.py` se encarga de:

- Convertir fechas a tipos temporales correctos.
- Derivar macro-regiones brasileñas para clientes y vendedores.
- Construir las dimensiones de clientes, productos, vendedores y fechas.
- Agregar pagos y reseñas por pedido **antes** de unirlos con los hechos — esto evita multiplicar filas cuando un pedido tiene varias transacciones de pago o varias reseñas.
- Construir `fact_sales` con granularidad `order_id + order_item_id`.
- Validar que la cantidad de filas de la tabla de hechos conserve el número de líneas de pedido original (control de integridad antes de escribir).
- Escribir cinco CSV en `data/processed/`.

## 3. Modelado y carga

`sql/create_star_schema.sql` crea el esquema `analytics`, sus restricciones, índices y vistas. `etl/load/postgres_loader.py` se encarga de:

- Crear el modelo solo si no está completo (idempotente a nivel de esquema).
- Cargar los CSV en lotes de 2.000 filas por defecto.
- Usar `ON CONFLICT DO NOTHING` para permitir cargas idempotentes a nivel de fila.
- Confirmar toda la operación dentro de una **transacción**.
- Ejecutar `rollback` ante cualquier error, evitando estados parciales en la base de datos.

## Por qué esta secuencia importa

El orden extracción → transformación → carga, con validaciones de integridad en cada frontera, es lo que permite que el pipeline sea confiable frente a un dataset con las condiciones reales descritas en el resumen general: formatos inconsistentes, nulos y duplicidad. Cada etapa asume que la anterior pudo fallar parcialmente y valida explícitamente antes de continuar, en vez de asumir datos limpios por defecto.
