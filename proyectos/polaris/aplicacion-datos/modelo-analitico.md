---
sidebar_position: 3
title: Modelo Analítico
---

# Aplicación de Datos — Modelo Analítico

El modelo sigue un **esquema estrella** clásico, optimizado para consultas analíticas desde Power BI.

| Objeto | Tipo | Propósito |
|---|---|---|
| `analytics.dim_customer` | Dimensión | Clientes y macro-región |
| `analytics.dim_product` | Dimensión | Productos y categorías traducidas |
| `analytics.dim_seller` | Dimensión | Vendedores y macro-región |
| `analytics.dim_date` | Dimensión | Calendario derivado de las fechas de pedidos |
| `analytics.fact_sales` | Hechos | Líneas de venta, logística, pagos y reseñas |
| `analytics.v_order_metrics` | Vista | Métricas agregadas a nivel de pedido |
| `analytics.v_sales_by_date_category` | Vista | Ventas por fecha y categoría, para consumo analítico directo |

Las claves foráneas, checks de valores no negativos e índices principales se definen en `sql/create_star_schema.sql`, asegurando integridad referencial a nivel de base de datos y no solo a nivel de código Python.

## Consumo analítico

La capa Gold (`analytics.*`) queda disponible para consumo directo en Power BI, cerrando el ciclo completo: dataset crudo de Kaggle → limpieza y modelado → base de datos analítica lista para visualización de negocio.
