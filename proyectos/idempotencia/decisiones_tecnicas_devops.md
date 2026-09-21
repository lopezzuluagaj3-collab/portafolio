# Documentación técnica — Infraestructura VPS Idempotencia

**Última actualización:** 19 de julio de 2026
**Responsable:** Juan (DevOps)

---

## 1. Resumen general

VPS única (4 GB de RAM) alojando el stack completo del proyecto **Idempotencia**: un producto **gestor de bases de datos** para usuarios finales (por eso corren 4 motores de DB). Incluye frontend, backend (producción y QA), y cuatro bases de datos, todo detrás de Nginx Proxy Manager (NPM) con SSL de Let's Encrypt. El acceso administrativo (SSH, bases de datos, paneles internos) está cerrado al público y se gestiona mediante **Tailscale** (VPN privada) y **port knocking**.

**IP pública de la VPS:** `<IP_PÚBLICA_VPS>`
**IP privada (Tailscale) de la VPS:** `<IP_PRIVADA_TAILSCALE>`

**Modelo de producto:** los usuarios finales de Idempotencia necesitarán conectar sus propias herramientas externas (Airflow, DBeaver, etc.) directamente a bases de datos gestionadas, con credenciales propias — no solo a través de la app web. Esto implica que, a futuro, algunos puertos de base de datos deberán exponerse de forma controlada (ver sección 10).

---

## 2. Firewall — estado actual y hallazgo crítico

### 2.1 Hallazgo de seguridad: Docker bypassea ufw

Se descubrió que **Docker inyecta sus propias reglas en `iptables`** (cadenas `DOCKER` / `FORWARD`) al publicar un puerto con `ports: "0.0.0.0:PUERTO:PUERTO"` en un `docker-compose.yml`. Estas reglas son independientes de `ufw` y se evalúan aparte — por lo que **un puerto podía estar públicamente accesible desde internet aunque `ufw status` no mostrara ninguna regla `ALLOW` para él**. Es un conflicto conocido entre Docker y ufw.

Esto se confirmó como la causa de un ataque de fuerza bruta real detectado contra el usuario `sa` de SQL Server, pese a que el diseño original asumía que ese puerto ya estaba restringido solo a Tailscale.

**Método de verificación en 3 capas (usar ante cualquier duda sobre exposición de un puerto):**
```bash
docker ps                                          # qué publica Docker
sudo ss -tulnp                                      # qué escucha realmente el host
timeout 2 bash -c "echo > /dev/tcp/<IP_PÚBLICA_VPS>/<puerto>" && echo "ABIERTO" || echo "cerrado"
```

### 2.2 Patrón de corrección aplicado

En cada `docker-compose.yml` afectado, cambiar:
```yaml
ports:
  - "0.0.0.0:PUERTO:PUERTO"
```
por:
```yaml
ports:
  - "<IP_PRIVADA_TAILSCALE>:PUERTO:PUERTO"   # solo accesible vía Tailscale
```
y recrear: `docker compose up -d --force-recreate <servicio>`. Esto **no** afecta la comunicación interna entre contenedores (que usa el nombre de contenedor sobre la red Docker, no el binding público), ni requiere tocar volúmenes.

### 2.3 Estado de cada puerto (snapshot actual)

| Puerto | Servicio | Binding | Estado |
|---|---|---|---|
| 22 | SSH | público, restringido — ver 3.1 | ✅ Controlado |
| 80 | NPM (HTTP) | público | ✅ Correcto (tráfico real) |
| 443 | NPM (HTTPS) | público | ✅ Correcto (tráfico real) |
| 81 | NPM panel admin | `<IP_PRIVADA_TAILSCALE>` (Tailscale only) | ✅ Cerrado |
| 1433 | SQL Server | `<IP_PRIVADA_TAILSCALE>` (Tailscale only) | ✅ Cerrado |
| 5432 | Postgres | `<IP_PRIVADA_TAILSCALE>` (Tailscale only) | ✅ Cerrado |
| 3306 | MySQL | `<IP_PRIVADA_TAILSCALE>` (Tailscale only) | ✅ Cerrado |
| 27017 | MongoDB | `<IP_PRIVADA_TAILSCALE>` (Tailscale only) | ✅ Cerrado |
| 9000 | Portainer | `<IP_PRIVADA_TAILSCALE>` (Tailscale only) | ✅ Correcto desde instalación |
| 8090, 6060 | CrowdSec (API/métricas) | `127.0.0.1` | ✅ No expuesto |
| 5555 | idempotencia-backend (prod) | interno (sin publicar) | ✅ No expuesto |
| **8080** | idempotencia-frontend (prod) | **público** | ⏳ Pendiente de cerrar |
| **8081** | idempotencia-frontend-qa | **público** | ⏳ Pendiente de cerrar |
| **5556** | idempotencia-qa-back | **público** | ⏳ Pendiente de cerrar |
| **7777** | idempotencia-documentacion | **público** | ⏳ Pendiente (evaluar si el contenedor sigue siendo necesario — la documentación ya vive en Vercel) |

**Nota sobre los pendientes:** el cierre de estos 4 puertos está en pausa intencionalmente — la decisión fue parametrizar la IP de Tailscale vía `.env`/secrets antes de tocar los composes, para no dejar la IP hardcodeada en el repositorio de git.

### 2.4 Hardening base del sistema
- `PermitRootLogin no`, `PasswordAuthentication no` (solo login por llave SSH) — **pendiente reconfirmar** que siga así en `/etc/ssh/sshd_config`
- Usuario `devop` con sudo
- fail2ban activo (jail `sshd`)
- **CrowdSec** instalado como capa adicional de detección y bloqueo (ver sección 7)
- `unattended-upgrades` instalado

---

## 3. Acceso remoto

### 3.1 SSH — Port knocking
El puerto 22 permanece cerrado por defecto. Para conectarse:

1. Se ejecuta un script PowerShell (`conectar.ps1`) que:
   - Envía una secuencia de "golpes" TCP a los puertos `7000, 8000, 9000` para abrir el 22
   - Lanza automáticamente la sesión SSH
   - En segundo plano, tras un tiempo de espera configurable, envía otra secuencia (`6000, 5000, 4000`) para volver a cerrar el puerto — sin necesidad de un script separado ni de esperar a cerrar la sesión
2. Cada persona del equipo que necesite acceso SSH directo requiere su propia llave autorizada en `~/.ssh/authorized_keys` de la VPS y su copia del script.

### 3.2 Tailscale — red privada del equipo
- Tailnet propia bajo la cuenta `lopezzuluagaj3@gmail.com`
- Dispositivos conectados: la VPS (`idempotencia`, IP privada `<IP_PRIVADA_TAILSCALE>`), la PC de Juan (`pcjuandiego`) y la PC de Santiago Botero (`santi`)
- Usado para acceder de forma privada a: las 4 bases de datos, el panel de NPM (`:81`), y Portainer (`:9000`)
- Plan gratuito, límite de 3 usuarios (suficiente para el equipo actual)

**Onboarding de un nuevo miembro:** aceptar la invitación por correo **no conecta automáticamente el dispositivo** — es necesario que la persona haga clic derecho en el ícono de Tailscale → "Log in..." y complete el login con la cuenta invitada específicamente. Verificar en el admin console (pestaña "Máquinas") que el dispositivo aparezca como "Connected" antes de asumir que tiene acceso.

---

## 4. GitHub / control de versiones

### 4.1 Organización
Organización dedicada donde solo Juan es admin.

### 4.2 Estrategia de ramas
```
feature/* → develop → QA → main
```
- **main:** producción, desplegada en la VPS
- **QA:** también desplegada en la VPS (decisión revisada respecto al plan original de probarla solo local), apuntando a las **mismas bases de datos** que producción — no hay ambientes de datos separados por falta de recursos
- **La rama QA está actualmente mucho más avanzada que main**, y se está usando activamente para probar la integración con las 4 bases de datos
- Solo los roles **QA** y **DevOps** tienen permiso de push/merge a `main` y `QA`

### 4.3 Branch protection rules (main y QA)
- Pull request obligatorio antes de mergear
- Restricción de push a un team dedicado (`qa-devop`)
- Bloqueo de force-push y de borrado de rama
- **Aprobaciones requeridas: 0** (decisión consciente — el equipo confía en el control manual del rol de QA)
- **Status checks:** desactivados por ahora, no hay pruebas unitarias/CI de tests configurado
- La validación de que un PR hacia `main` provenga específicamente de `QA` se hace de forma **manual**

---

## 5. Servicios desplegados

Todos corren en Docker Compose, conectados a la red externa compartida **`red-proxy`**.

| Servicio | Contenedor | Dominio / Puerto | Puerto interno |
|---|---|---|---|
| Frontend (prod) | `idempotencia-frontend` | `idempotencia.andrescortes.dev` | 80 |
| Frontend (QA) | `idempotencia-frontend-qa` | público en `:8081` (pendiente cerrar) | — |
| Backend (prod) | `idempotencia-backend` | `api.idempotencia.andrescortes.dev` | 5555 |
| Backend (QA) | `idempotencia-qa-back` | público en `:5556` (pendiente cerrar) | 5556 |
| Nginx Proxy Manager | — | panel en `<IP_PRIVADA_TAILSCALE>:81` | — |
| Portainer | `portainer` | `<IP_PRIVADA_TAILSCALE>:9000` | 9000 |

> **Documentación (Docusaurus):** ya no corre en la VPS de forma permanente. Se migró a **Vercel** (con CI/CD integrado). El contenedor `idempotencia-documentacion` (puerto 7777) sigue existiendo en la VPS, expuesto públicamente — pendiente evaluar si debe eliminarse por completo.

### 5.1 Frontend
- Build multi-stage: Node 20-alpine (build) + Nginx 1.27-alpine (serve)
- `mem_limit: 256m`, `cpus: 0.5`
- CI/CD: GitHub Actions con despliegue automático (tanto prod como QA)

### 5.2 Backend (.NET / idempotencia-back)
- Dockerfile multi-stage (SDK 10.0 → aspnet 10.0), usuario no-root (`app`)
- Producción escucha en `ASPNETCORE_URLS=http://+:5555`; QA en `:5556` (el 5555 ya estaba en uso)
- **`appsettings.json` se monta como volumen de solo lectura** en ambos ambientes — contiene credenciales reales (connection strings, JWT Key, `ClientSecret` OAuth Google/GitHub)
- **Todas las connection strings dentro de `appsettings.json` deben usar el nombre del contenedor** (ej. `Server=idempotencia-sqlserver`), nunca la IP pública ni la de Tailscale — ver incidente en sección 8
- Contiene una sección `Provisioning` (para aprovisionar bases de datos de usuarios finales del producto)
- Autenticación: JWT + OAuth externo (Google y GitHub)
- CI/CD: GitHub Actions dispara en push, hace port knocking, `git pull`, `docker compose down/up --build`
- `mem_limit: 512m` (prod) / `384m` (QA), logging con rotación (`max-size: 10m`, `max-file: 3`)

### 5.3 Proxy Hosts en NPM
Frontend y backend de producción usan Let's Encrypt con renovación automática. QA no pasa por NPM actualmente (acceso directo por IP:puerto vía Tailscale).

### 5.4 Incidente resuelto — rate limiting en NPM
Un `limit_req_zone` mal ubicado directamente en un Proxy Host causaba caídas del sitio. Se resolvió moviendo la zona a `data/nginx/custom/http_top.conf`, dejando solo el `limit_req` en la configuración del Proxy Host correspondiente.

---

## 6. Bases de datos

Las cuatro bases de datos comparten el mismo patrón de seguridad: publicadas únicamente sobre la IP de Tailscale (`<IP_PRIVADA_TAILSCALE>:PUERTO`), nunca sobre `0.0.0.0`.

| Motor | Contenedor | Puerto | Usuario admin | Notas |
|---|---|---|---|---|
| SQL Server 2022 | `idempotencia-sqlserver` | 1433 | `sa` (contraseña ya rotada) | Base principal (`master`) — compartida entre prod y QA |
| PostgreSQL 16 | `idempotencia-postgres` | 5432 | `postgres` | Base `main` |
| MongoDB 7 | `idempotencia-mongodb` | 27017 | `admin` | Auth database: `admin` |
| MySQL 8.4 | `idempotencia-mysql` | 3306 | `root` / `idempotencia` | Base `main`; usuario de aplicación con acceso limitado al schema |

Todos con `mem_limit: 512m`, `cpus: 0.5` y logging con rotación.

### 6.1 Deuda técnica importante — lógica de negocio en `master`
Toda la lógica de negocio (procedimientos almacenados) vive actualmente dentro de la base **`master`** de SQL Server, en vez de una base dedicada (ej. `idempotencia_app`). Esto es riesgoso para backups selectivos y migraciones futuras — pendiente de migrar (ver sección 10).

**Procedimientos almacenados confirmados existentes:** `sp_GetLoginByEmail`, `sp_UpsertExternalLogin`, `sp_RegisterUser`, `sp_GetPlatformStatistics`, `sp_ReserveDatabase`, `sp_ConfirmDatabase`, `sp_FailDatabase`, `sp_GetUserDatabases`.

### 6.2 Notas técnicas relevantes
- **La contraseña (`POSTGRES_PASSWORD`, `MYSQL_ROOT_PASSWORD`, etc.) solo se aplica en la primera inicialización del volumen de datos.** Cambiarla en el compose después no la actualiza — hay que borrar el volumen (si no hay datos que conservar) o cambiarla manualmente dentro del contenedor.
- **Símbolos `$` en contraseñas dentro de `docker-compose.yml` deben escribirse como `$$`**, o Docker Compose los interpreta como variable y los descarta silenciosamente. Recomendado generar contraseñas sin ese símbolo (`openssl rand -base64 24 | tr -d '$'`).
- **MySQL con `caching_sha2_password`** puede dar error *"Public Key Retrieval is not allowed"* en DBeaver — se soluciona con `allowPublicKeyRetrieval=true` en Driver properties.
- **Comunicación interna entre contenedores:** el backend debe usar siempre el **nombre del contenedor** en las connection strings (ej. `idempotencia-sqlserver`), no la IP pública ni la de Tailscale — usar IP pública desde dentro de la propia VPS puede causar timeouts intermitentes por hairpin NAT combinado con el firewall.

### 6.3 Conexión desde DBeaver / herramientas externas (equipo interno)
- **Host:** `<IP_PRIVADA_TAILSCALE>` (IP privada de Tailscale de la VPS)
- **Puerto:** el que corresponda (1433 / 5432 / 27017 / 3306)
- **SSL/TrustServerCertificate:** activado donde aplique

---

## 7. Monitoreo y seguridad activa

### 7.1 CrowdSec
Instalado nativo en el host (no como contenedor) para detectar y bloquear activamente ataques (ej. el de fuerza bruta contra `sa` en SQL Server).

**Componentes:**
- Agente `crowdsec` (systemd)
- `crowdsec-firewall-bouncer-iptables` (aplica los bloqueos vía iptables)
- Colecciones: `crowdsecurity/linux`, `crowdsecurity/sshd`, `crowdsecurity/nginx` (cubre RCE de PHPUnit, escaneo de `.env`/`.git`, SQLi/XSS probing, CVEs conocidos)

**Configuración no estándar aplicada:**
- API local movida de `8080` (conflicto con el frontend) a `127.0.0.1:8090`, actualizado en `/etc/crowdsec/config.yaml`, `local_api_credentials.yaml` y `bouncers/crowdsec-firewall-bouncer.yaml`
- Fuente de logs de NPM declarada en `/etc/crowdsec/acquis.d/nginx.yaml` (no en `acquis.yaml`, que queda vacío en versiones recientes):
```yaml
filenames:
  - /home/devop/nginx-proxy-manager/data/logs/*_access.log
labels:
  type: nginx
source: file
```

**Comandos de referencia:**
```bash
sudo cscli metrics          # actividad general de todas las fuentes
sudo cscli decisions list   # IPs bloqueadas activamente ahora mismo
sudo cscli alerts list      # alertas/incidentes detectados
sudo cscli bouncers list    # confirma que el bouncer está conectado
```

### 7.2 Portainer
Dashboard visual para gestión de contenedores (CPU/RAM por contenedor, reinicio con un clic, logs sin depender de SSH).

```bash
docker volume create portainer_data
docker run -d -p <IP_PRIVADA_TAILSCALE>:9000:9000 --name portainer --restart=unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```
**Acceso:** `http://<IP_PRIVADA_TAILSCALE>:9000` (requiere Tailscale activo). Nota: el setup inicial de usuario admin tiene una ventana de ~5 minutos; si expira, se necesita el `setup_token` (`docker logs portainer | grep setup_token`) junto con usuario/contraseña.

---

## 8. Incidentes resueltos (bitácora)

### 8.1 Error 500 en `/auth/register` — connection string con IP pública
**Síntoma:** timeout de conexión SQL (`SqlException`) al registrar un usuario.
**Causa:** la connection string de `ColmenaDbContext` apuntaba a `Server=<IP_PÚBLICA_VPS>` en vez de `Server=idempotencia-sqlserver`.
**Solución:** corregir el `Server=` al nombre del contenedor y reiniciar. Confirmado con registro exitoso y JWT devuelto.

### 8.2 Volumen duplicado de SQL Server al recrear el contenedor
**Síntoma:** al aplicar el nuevo binding de puerto con `--force-recreate`, Docker creó un volumen nuevo vacío (`idempotencia-db-sqlserver_sqlserver-data`) en vez de reutilizar el existente con datos reales (`idempotencia-db_sqlserver-data`) — mismatch entre el nombre de proyecto/carpeta y el volumen ya existente.

**Solución aplicada:**
1. Backup preventivo completo (`BACKUP DATABASE [master] TO DISK = ...`)
2. Export de los procedimientos almacenados en texto plano (`sys.procedures` + `OBJECT_DEFINITION`)
3. Ambos copiados al host con `docker cp` (sin wildcards — nombre exacto del archivo)
4. Volumen vacío eliminado (`docker volume rm`)
5. Compose corregido declarando el volumen explícitamente como `external: true`:
```yaml
services:
  idempotencia-sqlserver:
    volumes:
      - sqlserver-data:/var/opt/mssql
volumes:
  sqlserver-data:
    external: true
    name: idempotencia-db_sqlserver-data
```
6. Verificado con `docker inspect ... --format '{{ range .Mounts }}{{ .Name }}{{ println }}{{ end }}'`
7. Confirmados intactos los 8 procedimientos almacenados de negocio

**Lección:** antes de cualquier `--force-recreate` en un servicio con datos persistentes, verificar primero con `docker inspect` cuál es el volumen actualmente en uso, y declararlo explícitamente `external: true` si existe riesgo de que el nombre del proyecto genere un nombre de volumen distinto.

### 8.3 `appsettings.json` montado como directorio en vez de archivo
Si Docker no encuentra el archivo del host en el momento de crear el contenedor (por ejemplo si aún no existía o era una ruta mal escrita), crea automáticamente una **carpeta** en su lugar dentro del bind mount — y el tipo (archivo vs. carpeta) queda fijo hasta que el contenedor se recree desde cero. Causaba `UnauthorizedAccessException` / `mount ... not a directory` según el caso. Solución: corregir el archivo en el host, eliminar la imagen (`docker rmi`) y reconstruir sin caché (`docker compose build --no-cache`) para que la carpeta mal horneada no persista dentro de la imagen.

### 8.4 Permisos del `appsettings.json` (chmod 600 vs 644)
El proceso dentro del contenedor corre como usuario no-root (`app`), distinto al dueño del archivo en el host (`devop`). `chmod 600` bloqueaba la lectura desde el contenedor. Corregido a `644`.

---

## 9. Backups y persistencia

**Realizados (ad-hoc, no automatizados):**
- Backup completo de SQL Server (`.bak`) en `/home/devop/idempotencia-db-sqlserver/`
- Export de procedimientos almacenados en texto plano (`sps_backup.sql`)

**Estado:** antes de esta sesión no existía ningún backup de la base de datos (compartida entre producción y QA). **Backups automatizados recurrentes siguen pendientes** para las 4 bases de datos.

---

## 10. Pendientes abiertos

**Alta prioridad:**
1. Cerrar puertos 8080, 8081, 5556, 7777 al público (en pausa — parametrizar la IP de Tailscale vía `.env`/secrets antes de tocar los composes)
2. Rotar contraseñas de Postgres, MySQL y MongoDB (la de `sa` en SQL Server ya se rotó)
3. Confirmar que `appsettings.json` no esté en el historial de git: `git log --all --full-history -- "**/appsettings.json"`
4. Confirmar `PasswordAuthentication no` en `/etc/ssh/sshd_config`
5. Confirmar que la API remota de Docker (2375/2376) no quede expuesta en ningún compose futuro
6. Diagnosticar y resolver el error 500 pendiente en `/auth/register` (QA) — ya descartada causa de red, pendiente revisar log completo (posible conflicto de unicidad u otro punto del flujo)

**Media prioridad:**
7. Backups automatizados recurrentes (cron) de las 4 bases de datos
8. 2FA en GitHub (organización) y en Tailscale
9. Revisar consumo real de RAM con todo el stack corriendo (identificado ~2.3 GB de 3.7 GB en reposo — margen ajustado)
10. Persistir las DataProtection Keys del backend (`/home/app/.aspnet/DataProtection-Keys`) en un volumen

**Baja prioridad / mediano plazo:**
11. Migrar la lógica de negocio (procedimientos almacenados) de la base `master` a una base dedicada (`idempotencia_app` o similar)
12. Diseñar la arquitectura de exposición segura de las 4 DBs para **usuarios finales externos** del producto — aislamiento por cliente (usuario/base dedicada por cliente), proxy tipo HAProxy/PgBouncer/ProxySQL como punto único expuesto, rate limiting y fail2ban por motor. Sigue en fase de discusión conceptual, sin implementación.

---

## 11. Kubernetes — evaluado y descartado por ahora

Se evaluó migrar los ~9 contenedores actuales a Kubernetes. Conclusión: **no es viable en este momento** — la VPS es un solo nodo con 4 GB de RAM, y K8s (incluso `k3s`) consume recursos de control plane significativos sin aportar su beneficio principal (distribución entre múltiples nodos). Se recomienda continuar con Docker Compose (reforzado con `restart: unless-stopped` en todos los servicios) y reevaluar K8s administrado (EKS/GKE/DigitalOcean) solo si el proyecto escala a múltiples servidores.

---

## 12. Lecciones operativas (referencia rápida)

- `docker-compose.yml` separados por servicio no comparten `depends_on` entre archivos — el orden de arranque se gestiona manualmente si ya están en la misma red externa.
- Un contenedor "Up" no garantiza que esté sirviendo tráfico correctamente: validar con `docker logs` y un `curl`/`echo > /dev/tcp` interno.
- Un `502 Bad Gateway` de `openresty` (NPM) indica que el proxy no alcanza al contenedor destino (puerto/red incorrectos); un `404` de la propia app confirma que la red funciona y el problema es de rutas dentro de la aplicación.
- Contenedores "huérfanos" (`docker compose down` sin `--remove-orphans` tras renombrar un servicio) pueden retener un volumen y bloquear su eliminación.
- **Docker bypassea `ufw`** al publicar puertos — `ufw status` limpio no garantiza que un puerto esté cerrado; verificar siempre con `ss -tulnp` y una prueba de conexión externa real.
- Antes de `--force-recreate` en un servicio con volumen de datos, confirmar con `docker inspect` cuál es el volumen realmente en uso.
- Las connection strings dentro de contenedores deben usar siempre el **nombre del contenedor**, nunca IP pública ni de Tailscale.