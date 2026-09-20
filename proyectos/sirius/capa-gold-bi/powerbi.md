---
sidebar_position: 3
title: Visualización en Power BI & Seguridad IAM
---

# Consumo Analítico en Power BI y Seguridad Least Privilege

## Principio de Mínimo Privilegio (IAM Least Privilege)

Conectar herramientas analíticas de escritorio (como Power BI Desktop) usando credenciales de administrador es un riesgo crítico de seguridad. Para aislar completamente el acceso:

- Se aprovisionó mediante Terraform el usuario IAM dedicado **`sirius-powerbi-reader`**.
- La política IAM asociada restringe sus acciones estrictamente a:
  - `glue:GetDatabase`, `glue:GetTable`, `glue:GetPartitions` exclusivamente sobre `sirius_mart_db`.
  - `athena:StartQueryExecution`, `athena:GetQueryResults` restringido al Workgroup `sirius-eda`.
  - `s3:GetObject` sobre `s3://sirius-mart-.../mart/*`.
  - `s3:PutObject` y `s3:GetBucketLocation` sobre `s3://sirius-mart-.../result_eda/*` (para almacenar temporalmente los resultados de las consultas de Power BI).
  - **Cero acceso** a la consola de AWS, a las capas Row y Staging, a Terraform ni a Lambda/Glue.

---

## Conexión Nativa mediante Simba Athena ODBC

La conexión se realiza configurando un DSN de usuario en Windows de 64 bits (`sirius_mart`) apuntando al driver ODBC oficial de Amazon Athena:
- **Región:** `us-east-1`
- **Catálogo:** `AwsDataCatalog`
- **Base de Datos:** `sirius_mart_db`
- **Workgroup:** `sirius-eda`
- **Output S3:** `s3://sirius-mart-.../result_eda/`
- **Modo de Almacenamiento:** **Import** (los 388 MB se cargan en memoria en la estación de trabajo en menos de 2 segundos, eliminando costos por consultas interactivas repetidas).

---

## Arquitectura de los Dashboards Ejecutivos

El modelo analítico en Power BI implementa 3 páginas estratégicas para la toma de decisiones:

1. **Página 1 — Evolución de Cuota de Mercado (18 Años):**
   - Gráfico de áreas apiladas mostrando la transición desde el monopolio del Yellow Taxi (2009) hasta el dominio aplastante de Uber/Lyft (>80% en 2023-2026).
   - Indicadores de impacto de la pandemia de COVID-19 en marzo-abril de 2020 (-85% en volumen de viajes).
2. **Página 2 — KPIs Financieros y Rendimiento Económico:**
   - Comparativa de tarifa base, propina promedio por servicio, peajes e ingresos de conductores.
   - Dispersión de tarifa promedio por milla frente a duración del viaje.
3. **Página 3 — Demanda Territorial y Corredores de Movilidad:**
   - Mapa de coropletas y matriz de flujos entre los 5 distritos de NYC (Manhattan, Queens, Brooklyn, Bronx, Staten Island) y los aeropuertos clave (JFK, LaGuardia).
