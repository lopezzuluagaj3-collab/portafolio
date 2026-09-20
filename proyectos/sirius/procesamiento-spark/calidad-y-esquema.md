---
sidebar_position: 2
title: Calidad de Datos & Schema Drift
---

# Calidad de Datos y Tolerancia a Schema Drift

## El Problema del Schema Drift en 18 Años de TLC

A lo largo de casi dos décadas, los datos de NYC TLC sufrieron alteraciones constantes en sus tipos de datos:
- Columnas numéricas serializadas como texto con decimales: `'1.0'`, `'2.0'`.
- Si Spark intenta castear directamente una cadena con punto flotante `'1.0'` a `IntegerType`, Spark devuelve `null`, corrompiendo silenciosamente millones de registros.
- Columnas de identificación (`vendor_id`, `rate_code`) que pasaron de cadenas alfanuméricas (`'VTS'`, `'DDS'`) a enteros (`1`, `2`).

## Solución: Universal Safe Cast en Dos Fases

Para garantizar un esquema 100% predecible y evitar fallos por desbordamiento o nulidad inesperada, se implementó una función de casteo seguro universal:

```python
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, IntegerType, LongType, StringType

def safe_cast_int(col_name):
    """
    Convierte cadenas a Integer absorbiendo representaciones flotantes ('1.0' -> 1).
    Fase 1: Cast a String y strip de espacios.
    Fase 2: Cast a DoubleType para absorber punto flotante.
    Fase 3: Cast final a IntegerType.
    """
    return F.col(col_name).cast(StringType()).cast(DoubleType()).cast(IntegerType())
```

---

## Filtros de Calidad y Limpieza Analítica

Durante la transformación en PySpark, se aplicaron reglas de negocio rigurosas para descartar datos corruptos:

1. **Consistencia Temporal:**
   - Se descartan registros donde `dropoff_datetime < pickup_datetime` (viajes con duraciones negativas causadas por desajustes en relojes GPS).
   - Se filtran viajes fuera de los límites del periodo correspondiente.
2. **Consistencia Financiera:**
   - En las tablas analíticas se filtran viajes con distancias `<= 0` y tarifas negativas o en cero derivadas de devoluciones, disputas o cancelaciones erróneas.
3. **Mapeo Dimensional de Zonas (Lookup):**
   - Transición del sistema antiguo de coordenadas GPS latitud/longitud (vigente hasta 2016) al sistema moderno de **265 Zonas TLC**.
   - Integración de `taxi_zone_lookup.csv` mediante un broadcast join en PySpark para enriquecer los registros con `Borough`, `Zone` y `service_zone`.
