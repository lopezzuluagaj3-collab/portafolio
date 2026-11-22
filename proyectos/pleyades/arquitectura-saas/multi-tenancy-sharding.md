# 2. Multi-Tenancy Estricto (Database-per-Tenant) y Sharding Dinámico

Este módulo documenta el modelo de aislamiento multi-inquilino de **Pléyades**, el patrón de aislamiento físico de datos (*Database-per-Tenant*), el dimensionamiento matemático del pool de conexiones frente a Kubernetes HPA, el patrón *Show-Once* para credenciales efímeras y el protocolo de auditoría de aislamiento de bases de datos.

---

## 🏛️ Decisiones de Arquitectura del Dominio (ADRs)

### 📌 ADR 10: In-Cluster PostgreSQL Master Database como StatefulSet con Azure Disk (managed-csi) [Entorno de Desarrollo]
* **Estado:** Retirado en AKS (reemplazado por ADR 30); mantenido solo para desarrollo local.
* **Decisión:** Desplegar PostgreSQL 16 (`postgres:16-alpine`) bajo el patrón **`StatefulSet`** en el namespace `database`, utilizando aprovisionamiento dinámico con StorageClass **`managed-csi`** (Azure Managed Disk Standard SSD, 5 GiB) y aislamiento del directorio de datos binarios mediante `PGDATA=/var/lib/postgresql/data/pgdata`.
* **Justificación y Métricas:**
  1. **Optimización Financiera:** Costo de <$0.50 USD/mes y consumo de únicamente **~31 MiB RAM y 23m CPU**, preservando >5.7 GiB libres en el nodo.
  2. **Persistencia e Identidad Determinística:** Identidad de red fija (`postgres-0`), resolución DNS interna en CoreDNS (`postgres-service.database.svc.cluster.local:5432`) y acoplamiento exclusivo del PVC.
  3. **Prevención de Fallo `lost+found`:** Al formatear ext4 en Azure Disks se crea `/lost+found`. Apuntar `PGDATA` a `/pgdata` elimina el aborto de `initdb`.
* **Transición a Nube y Retiro en AKS:** Con la puesta en marcha de Azure Flexible Server (`psql-pleyades-dev-01`, ADR 30), el StatefulSet in-cluster fue escalado a 0 réplicas para evitar el riesgo operacional de split-brain en la persistencia.

---

### 📌 ADR 14: Gestión y Dimensionamiento del Pool de Conexiones a PostgreSQL frente al HPA y Cuotas de Tenants (Fuente de Verdad Única)
* **Estado:** Aceptado e Implementado ([PR #32](https://github.com/lopezzuluagaj3-collab/pleyades-app/pull/32), [PR #35](https://github.com/lopezzuluagaj3-collab/pleyades-app/pull/35), [PR #36](https://github.com/lopezzuluagaj3-collab/pleyades-app/pull/36) y [PR #37](https://github.com/lopezzuluagaj3-collab/pleyades-app/pull/37) en App; [PR #32](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/32) y [PR #33](https://github.com/lopezzuluagaj3-collab/pleyades-gitops/pull/33) en GitOps).
* **Decisión:** Parametrizar el pool de conexiones en Go (`pgx/v5/stdlib`) mediante variables de entorno defensivas:
  1. `cfg.MaxOpenConns`: **3 conexiones por pod** (decisión final vigente que prevalece sobre el valor histórico de 4 para garantizar estabilidad frente a HPA y cuotas de tenants).
  2. `cfg.MaxIdleConns`: **3 conexiones por pod**.
  3. `db.SetConnMaxLifetime(5 * time.Minute)` y `db.SetConnMaxIdleTime(5 * time.Minute)`.
  4. `CONNECTION LIMIT 2` por cada tenant en PostgreSQL (`ALTER ROLE "usr_<slug>" CONNECTION LIMIT 2;`).
* **Dimensionamiento Matemático del Pool:**
  1. **Límites Reales Medidos en Azure CLI (Salida Cruda Oficial):**
     - `max_connections = 50`
     - `superuser_reserved_connections = 10`
     - `reserved_connections = 5`
     - **Conexiones Utilizables:** $50 - (10 + 5) = \mathbf{35\text{ conexiones efectivas utilizables}}$.
  2. **Presupuesto Consolidado:**
     - Consumo máximo de hasta 7 tenants a tope: $7 \times 2 = \mathbf{14\text{ conexiones}}$.
     - Presupuesto remanente para la app: $35 - 14 = \mathbf{21\text{ conexiones}}$.
  3. **Aritmética Defensiva del Microservicio:**
     - **Carga Nominal (3 pods):** App consume $3 \times 3 = 9$ conns. Total con tenants: $9 + 14 = \mathbf{23\text{ conns}}$ sobre 35 utilizables (**12 slots libres / 34% de margen**).
     - **Pico de HPA (5 pods):** App consume $5 \times 3 = 15$ conns. Total con tenants: $15 + 14 = \mathbf{29\text{ conns}}$ sobre 35 (**6 slots libres / 17% de margen**).
     - **RollingUpdate bajo Carga Máxima (`maxSurge: 1`, 6 pods transitorios):** App consume $6 \times 3 = 18$ conns. Total con tenants: $18 + 14 = \mathbf{32\text{ conns}}$ sobre 35, garantizando **3 slots libres permanentes (8.5% de margen)** e imposibilitando por diseño el error `too many clients already`.

---

### 📌 ADR 25: Arquitectura Multi-Tenant con Aislamiento Lógico (Database-per-Tenant), Funciones Atómicas (SRP) y Preparación para Crossplane
* **Estado:** Aceptado e Implementado.
* **Decisión:**
  1. **Modelo Database-per-Tenant:** Cada inquilino recibe su propia base de datos lógica (`tenant_<slug>`) y su usuario dedicado (`usr_<slug>`).
  2. **Aislamiento Lógico Estricto:** Ejecución obligatoria de `REVOKE CONNECT ON DATABASE "<dbName>" FROM PUBLIC;` antes de otorgar privilegios exclusivos al rol del tenant, garantizando que usuarios ajenos reciban `FATAL: permission denied for database "tenant_b"`.
  3. **Cota de Longitud contra Truncamiento (`NAMEDATALEN = 64`):** PostgreSQL trunca silenciosamente identificadores a 63 bytes. Se acotó el slug estrictamente de **3 a 30 caracteres** mediante regex `^[a-z][a-z0-9-]{1,28}[a-z0-9]$`, garantizando que el identificador más largo (`tenant_<slug>` con 37 caracteres) quede a 26 bytes del límite del motor y eliminando cualquier colisión.

---

### 📌 ADR 26: Patrón de Seguridad de Credenciales Efímeras (Show-Once Pattern) y Endpoint de Rotación de Contraseñas
* **Estado:** Aceptado e Implementado.
* **Decisión:**
  1. **Patrón Show-Once:** Las contraseñas de las bases de datos de los inquilinos se generan con alta entropía (`crypto/rand`), se aplican al motor y se devuelven en la respuesta HTTP `201 Created` una **única vez**, sin almacenarse jamás en texto plano ni cifrado en la base de metadatos principal (`pleyades_db`).
  2. **Endpoint de Rotación (`POST /api/v1/tenants/{id}/reset-password`):** Permite al propietario regenerar la contraseña en cualquier momento bajo autorización JWT (previniendo vulnerabilidades OWASP BOLA/IDOR).
  3. **Regla de Exclusión para Cachés Compartidas:** Respuestas con credenciales nunca se persisten en Redis/Valkey para evitar exposición en reposo.

---

### 📌 ADR 31: Arquitectura Multi-Tenant con Sharded Database Server Pools (Bin-Packing de 5 a 7 Tenants por ADBFP)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Particionamiento horizontal de servidores de bases de datos:
  1. **Entidad `DatabasePool`:** Tabla en BD que monitorea instancias físicas de Azure PostgreSQL Flexible Server, controlando `current_tenants`, `max_tenants = 7` y estados (`ACTIVE`, `FULL`, `MAINTENANCE`).
  2. **Algoritmo de Bin-Packing:** Selección del pool activo con menor carga (`current_tenants < max_tenants`). Al alcanzar 7 tenants, el pool pasa automáticamente a estado `FULL` y redirige el tráfico al siguiente pool.

---

## 🛡️ Protocolo de Verificación de Aislamiento de Inquilinos

Para auditar que el aislamiento estricto implementado en ADR 25 y SEC-02 previene el acceso no autorizado entre bases de datos de distintos tenants en el mismo servidor físico:

```bash
# 1. Intentar conectar con las credenciales de 'usr_acmecloud' a la base de datos de 'orioncorp':
psql "host=localhost port=5432 user=usr_acmecloud password='<password>' dbname=tenant_orioncorp"

# 2. Salida esperada del motor PostgreSQL (Rechazo inmediato por REVOKE CONNECT FROM PUBLIC):
psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed:
FATAL: permission denied for database "tenant_orioncorp"
DETAIL: User does not have CONNECT privilege.
```
