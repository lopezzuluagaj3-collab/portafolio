# 1. Arquitectura Hexagonal y Microservicio Core en Go 1.24

Este módulo documenta la arquitectura de software del microservicio central **`pleyades-app`**, desarrollado en **Go 1.24** bajo los principios de **Clean Architecture / Hexagonal (Ports & Adapters)**, su pipeline de middlewares transversales, criptografía segura, mitigación de timing attacks, calidad DevSecOps y empaquetado distroless de mínimo footprint.

---

## 🏛️ Decisiones de Arquitectura del Dominio (ADRs)

### 📌 ADR 01: Metodología de Versionamiento en Git (Trunk-Based Development & Convención de Commits)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Trabajar bajo **Trunk-Based Development** con ramas de corta duración (*short-lived branches*) que integran a `main` vía Pull Requests squash.
* **Estándar de Commits y Staging Granular:**
  1. **Nomenclatura Estricta:** `<nombre-rama> -> <accion>: <explicacion>` (ej. `feat/crossplane-operator -> add: configure Crossplane Helm release and Azure Provider`).
  2. **Staging Atómico (Anti-`git add .`):** Prohibido el uso indiscriminado de `git add .`. Cada componente se prepara y commitea de manera aislada y atómica.
* **Justificación:** Evitar ramas de larga vida, merge conflicts complejos y garantizar trazabilidad atómica y auditable en entrega continua.
* **Alternativas consideradas:** GitFlow tradicional (descartado por sobrecarga operativa de ramas `develop`, `release/*`).

---

### 📌 ADR 12: DevSecOps Quality & Security Gates en Microservicio Go (`pleyades-app`)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Implementar una suite de CI con 7 compuertas desacopladas:
  1. **Detección de Secretos (`gitleaks`):** Historial profundo (`fetch-depth: 0`) para bloquear fugas de credenciales.
  2. **Calidad y SAST (`golangci-lint` con `gosec`):** Validación de construcciones sospechosas, `errcheck` y vulnerabilidades AST.
  3. **Pruebas y Cobertura (`go test`):** Exportación de perfil de cobertura (`coverage.out`).
  4. **SCA (`govulncheck` + `trivy fs`):** Grafo de llamadas de Go oficial y auditoría de filesystem.
  5. **Seguridad de Contenedores (`trivy image`):** Escaneo de vulnerabilidades del OS base y binario sobre la imagen distroless.
  6. **DAST (`OWASP ZAP API Scan`):** Ataques dinámicos contra endpoints de OpenAPI/Swagger con BD efímera.
  7. **Compuerta Cloud (`SonarCloud Quality Gate`):** Auditoría estática en PRs (reglas `go:S6437` y `go:S2077`).

---

### 📌 ADR 13: Arquitectura Limpia Hexagonal (Ports & Adapters) en Microservicio Go (`pleyades-app`)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Construir el microservicio utilizando exclusivamente la biblioteca estándar de Go (`net/http` de Go 1.22+) sin frameworks invasivos (como Gin o Fiber):
  1. **Dominio (`internal/domain`):** Entidad `User`, invariantes puras y errores centinela. Cero dependencias externas.
  2. **Puertos (`internal/ports`):** Interfaces abstractas segregadas (`UserRepository`, `PasswordHasher`, `TenantProvisioner`, `TokenService`).
  3. **Casos de Uso (`internal/usecase`):** Orquestación pura de negocio (`RegisterUserUseCase`, `LoginUserUseCase`, `CreateTenantUseCase`).
  4. **Adaptadores (`internal/adapters`):** `http/` (rutas y DTOs), `postgres/` (persistencia con `pgx/v5`), `crypto/` (`bcrypt` y `jwt`).
  5. **Punto de Composición (`cmd/pleyades-app/main.go`):** Composition Root exclusivo de inyección de dependencias.

---

### 📌 ADR 15: Configuración Cloud-Native "Fail-Fast" y Gestión de Entornos (12-Factor App)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Carga de configuración (`internal/config/config.go`) con tolerancia dual: lee `.env` en desarrollo local pero falla de inmediato (*Fail-Fast*) en producción si falta cualquier variable obligatoria (`DB_PASSWORD`, `DB_USER`, `DB_HOST`, `DB_NAME`, `JWT_SECRET`) inyectada vía ConfigMap/Secret en Kubernetes. Cero valores por defecto quemados en código fuente.

---

### 📌 ADR 16: Principio de Responsabilidad Única (SRP) y Mapeo Desacoplado en Handlers HTTP
* **Estado:** Aceptado e Implementado.
* **Decisión:** Segregar DTOs de red (`RegisterUserRequest`, `UserResponse`) de las entidades de dominio, evitando que datos sensibles (hashes o contraseñas) se expongan. Mapeo determinista de errores (`mapError`) traduciendo errores centinela de dominio a códigos de estado HTTP (201, 400, 401, 403, 409, 500).

---

### 📌 ADR 17: Criptografía y Hashing Seguro de Contraseñas mediante el Patrón Puerto-Adaptador y Mitigación de Timing Attacks (SOLID)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Hashing seguro mediante `bcrypt` con costo configurable (10 rounds, ~70ms de CPU por hash).
* **Mitigación Activa de Timing Attacks:** El puerto expone `CompareDummy(password)`, garantizando que tanto si el usuario existe con contraseña errónea como si no existe en absoluto, el servidor consuma exactamente ~70ms de cómputo Bcrypt, neutralizando la inferencia estadística de usuarios válidos (OWASP A07:2021). El baseline se genera con `crypto/rand` en memoria, eliminando hashes estáticos en código (SonarCloud `go:S6437`).

---

### 📌 ADR 18: Resolución Estricta de Alertas SAST en CI/CD (`gosec` G304, `errcheck` y SonarCloud `go:S2077` en DDL Dinámico)
* **Estado:** Aceptado e Implementado.
* **Decisión:** Cero `#nosec`. Mitigación de path traversal (G304) y descarte intencional explícito en cierres (`defer func() { _ = file.Close() }()`).
* **Supresión Auditada de SonarCloud (`go:S2077`) en DDL de PostgreSQL:** Como el protocolo nativo de PostgreSQL no admite parámetros posicionales (`$1`) para sentencias DDL (`CREATE DATABASE`, `REVOKE CONNECT`), se autoriza `// NOSONAR` sustentada en **4 controles compensatorios concurrentes**:
  1. *Validación por lista blanca regex:* Slug acotado estrictamente a `^[a-z][a-z0-9-]{1,28}[a-z0-9]$` (3 a 30 caracteres).
  2. *Prevención de truncamiento (`NAMEDATALEN = 64`):* Con slug de máximo 30 caracteres, los nombres generados (`tenant_<slug>` de máx 37 y `usr_<slug>` de máx 34) nunca alcanzan los 63 bytes de PostgreSQL, eliminando colisiones.
  3. *Delimitación segura con comillas dobles:* `"CREATE DATABASE \"%s\""` forzando interpretación de identificador literal.
  4. *Comentario de auditoría:* Documentación explícita de justificación.

---

### 📌 ADR 19: Graceful Shutdown y Manejo del Ciclo de Vida Cloud-Native en Kubernetes
* **Estado:** Aceptado e Implementado.
* **Decisión:** Intercepción de señales `os.Interrupt` y `syscall.SIGTERM` (enviada por el Kubelet). Ventana de gracia defensiva de 10 segundos: detiene admisión de nuevas conexiones HTTP, drena peticiones en vuelo, cierra transacciones en PostgreSQL y finaliza con código 0 mucho antes de los 30s de `terminationGracePeriodSeconds` de Kubernetes (*Zero-Downtime Deployments*).

---

### 📌 ADR 21: Estrategia de Pruebas Unitarias Aisladas y Mocks de Puertos en Memoria
* **Estado:** Aceptado e Implementado.
* **Decisión:** Mocks ligeros basados en closures nativos sin librerías externas pesadas. Pruebas table-driven para invariantes de dominio (RFC 5322, entropía de passwords) y pruebas HTTP con `httptest.NewRecorder()`. Cobertura >90% en dominio, usecase y adaptadores, ejecutándose en <2 segundos en GitHub Actions.

---

### 📌 ADR 23: Arquitectura del Pipeline de Middlewares Transversales
* **Estado:** Aceptado e Implementado.
* **Decisión:** Encadenamiento declarativo `Chain(h, middlewares...)`:
  - `metrics.go`: Latencias, throughput y saturación in-flight para Prometheus.
  - `auth.go`: Validación JWT con **Sliding Session Renewal** (emite `X-Renewed-Token` tras actividad).
  - `ratelimit.go`: Token Bucket thread-safe en memoria por IP (20 req/s sostenidas, ráfaga de 50).
  - `idempotency.go`: Cabecera estándar `Idempotency-Key` con prevención de concurrencia (409) y respuesta transparente.

---

### 📌 ADR 24: Endpoint de Autenticación de Usuarios (`POST /api/v1/auth/login`) y Emisión de JWT
* **Estado:** Aceptado e Implementado.
* **Decisión:** Autenticación de usuarios validando hashes Bcrypt, mitigación de timing attacks con `CompareDummy` y emisión de Bearer Token JWT (TTL 15 minutos). Manejo del error genérico `ErrInvalidCredentials` para impedir la enumeración de usuarios.

---

### 📌 ADR 27: Documentación Viva Interactiva mediante Swagger UI y Especificación Swagger 2.0 / OpenAPI 2.0
* **Estado:** Aceptado e Implementado.
* **Decisión:** Generación declarativa de contratos con `swaggo/swag` a partir de anotaciones en handlers. Interfaz Swagger UI embebida en `/swagger/index.html` con botón interactivo **Authorize** para probar endpoints protegidos con BearerAuth JWT e Idempotencia.

---

### 📌 ADR 28: Contenerización Multi-Stage con Imagen Base Distroless y Pod Security Standards Restricted
* **Estado:** Aceptado e Implementado.
* **Decisión:** Build multi-stage: etapa 1 con `golang:alpine` (compilación estática `CGO_ENABLED=0` con `-ldflags="-s -w"`); etapa 2 con `gcr.io/distroless/static-debian12:nonroot` (usuario `nonroot:nonroot`, UID 65532). Imagen final de **10.3 MB** en GHCR con **0 vulnerabilidades High/Critical** en escaneos Trivy.

---

## 🛠️ Runbook de Bootstrap: Pasos 8 y 9 (PowerShell)

### Paso 8: Ejecución y Verificación Local del Microservicio (`pleyades-app`)
```powershell
# 1. Iniciar contenedor de PostgreSQL local
docker run -d `
  --name pleyades-postgres `
  -e POSTGRES_USER=pleyades_admin `
  -e POSTGRES_PASSWORD=pleyades_password `
  -e POSTGRES_DB=pleyades_db `
  -p 5432:5432 `
  postgres:16-alpine

# 2. Iniciar el microservicio en Go (Terminal 1)
cd $PROJECT_ROOT\pleyades-app
go run ./cmd/pleyades-app

# 3. Registrar usuario mediante API REST (Terminal 2)
Invoke-RestMethod -Uri http://localhost:8080/api/v1/users `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"arquitecto@pleyades.io","password":"Password123!","name":"Arquitecto Cloud"}'

# 4. Iniciar sesión y obtener JWT (TTL 15m)
$LoginResponse = Invoke-RestMethod -Uri http://localhost:8080/api/v1/auth/login `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"arquitecto@pleyades.io","password":"Password123!"}'
$Token = $LoginResponse.access_token
Write-Host "JWT Obtenido: $Token"

# 5. Documentación interactiva Swagger UI:
# Abrir en navegador: http://localhost:8080/swagger/index.html
```

---

### Paso 9: Ejecución de Pruebas Unitarias y Análisis de Cobertura
```powershell
cd $PROJECT_ROOT\pleyades-app

# 1. Ejecutar pruebas unitarias completas y exportar perfil de cobertura
go test -v "-coverprofile=coverage.out" ./...

# 2. Visualizar reporte de cobertura por función
go tool cover "-func=coverage.out"

# 3. (Opcional) Ver reporte visual en navegador
go tool cover "-html=coverage.out"
```
