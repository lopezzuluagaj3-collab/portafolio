
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
  - **Cero acceso** a la consola de AWS, a las capas Bronze y Silver, a Terraform ni a Lambda/Glue.

---

## Conexión Nativa mediante Simba Athena ODBC

La conexión se realiza configurando un DSN de usuario en Windows de 64 bits (`sirius_mart`) apuntando al driver ODBC oficial de Amazon Athena:
- **Región:** `us-east-1`
- **Catálogo:** `AwsDataCatalog`
- **Base de Datos:** `sirius_mart_db`
- **Workgroup:** `sirius-eda`
- **Output S3:** `s3://sirius-mart-.../result_eda/`
- **Modo de Almacenamiento:** **Import** (los Data Marts se cargan en memoria en la estación de trabajo en ~1.2 segundos, permitiendo operar 100% desconectado tras el `terraform destroy`).

---

## 📊 Arquitectura de los Dashboards Ejecutivos

El modelo analítico en Power BI implementa 3 páginas estratégicas para la toma de decisiones, diseñadas bajo un Dark Theme de alto contraste:

### 1. Visión Ejecutiva y Cuota de Mercado (2009 - 2026)
![Dashboard Página 1](assets/img/sirius/dashboard_1.png)

- **Propósito:** Contar la disrupción de la movilidad urbana en NYC, la irrupción de las plataformas tecnológicas y la resiliencia tras la pandemia de 2020.
- **Métricas Clave:**
  - `Total Viajes Analizados`: **4.42B** (SUM acumulada).
  - `Cuota Apps (FHVHV)`: **80.9%** (Acento púrpura neón).
  - `Cuota Taxis Amarillos`: **13.7%** (Acento amarillo taxi).
  - `Mes Pico Histórico`: **32.8M** viajes (Octubre 2019).
- **Interactividad:** Filtro de año desplegable, selector de tipo de servicio y botón `🔄 Actualizar Datos`.

---

### 2. KPIs Financieros y Rendimiento Económico
![Dashboard Página 2](assets/img/sirius/dashboard_2.png)

- **Propósito:** Evaluar la economía del transporte, la evolución de los costos por milla y la distribución de ingresos entre plataformas y conductores.
- **Métricas Clave:**
  - `Facturación Bruta Total`: **$84.2B USD**.
  - `Tarifa Base Media`: **$18.45 USD**.
  - `Propina Promedio (%)`: **16.8%** (Acento verde neón).
  - `Pago Conductor Promedio (FHVHV)`: **$14.20 USD / viaje**.
- **Análisis Gráfico:** Comparativa histórica de tarifa por viaje y tarifa por milla ($/milla) entre Yellow Taxi, Green Taxi, Apps y Livery.

---

### 3. Dinámica Espacio-Temporal y Horaria
![Dashboard Página 3](assets/img/sirius/dashboard_3.png)

- **Propósito:** Analizar la distribución territorial (origen/destino) y los patrones horarios de demanda para optimización de flota.
- **Filtros Desplegables Tipo Acordeón:**
  - 📍 `Origin Borough` y 🎯 `Destination Borough`.
  - 📅 `Día de la Semana` (*Lunes a Domingo*): Transforma la curva horaria en tiempo real (picos de oficina 8-9 AM vs. picos nocturnos 10 PM - 2 AM).
  - 🚕 `Tipo de Servicio`: Selector de modalidad.
- **Matriz de Calor:** Matriz cruzada de volumen de viajes entre todos los distritos de NYC.
- **Curva Horaria 24h:** Perfil continuo de demanda hora a hora (0-23h).

---

## 🏛️ Modelo de Datos Semántico (Semantic Model)
![Modelo de Datos en Power BI](assets/img/sirius/model_view.png)

El modelo semántico integra las 4 tablas marts optimizadas mediante VertiPaq, asegurando cálculos dinámicos instantáneos sin recálculos costosos en la nube.

