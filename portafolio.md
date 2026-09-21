# Portafolio Profesional DevOps — Juan Diego López Zuluaga
> **Compendio Ejecutivo de Proyectos: Infraestructura Cloud, Kubernetes, Seguridad Perimetral y Datos**

Este documento recopila el contexto ejecutivo, las decisiones arquitectónicas y las acciones tomadas desde mi rol como **DevOps & Cloud Infrastructure Engineer** a través de los proyectos consolidados en este portafolio (**Polaris** e **Idempotencia**).

---

## 📌 Enlaces Rápidos del Repositorio
- 🌐 **[Aplicación Web del Portafolio (index.html)](./index.html):** Portafolio interactivo con el sistema de diseño Docusaurus (violeta/coral, modo oscuro/claro, simulador de terminal y visores de documentación técnica).
- 📖 **[Documentación Maestra (README.md)](./README.md):** Manual consolidado del portafolio, estructura de directorios, perfiles de contacto y comandos de despliegue local.

---

## 🚀 Contexto del Proyecto: Idempotencia

**Idempotencia** es una plataforma de **Database-as-a-Service (DBaaS)** orientada a desarrolladores. Permite crear y aprovisionar bases de datos en segundos sin necesidad de tickets o esperas:
- **Estado:** 🟡 **Fuera de Producción / Archivado** (Ciclo de evaluación y entrega completado).
- **Motores Soportados:** SQL Server 2022, PostgreSQL 16, MySQL 8.4 y MongoDB 7.
- **Módulo de IA:** Gateway con FastAPI y Ollama (`qwen2.5:3b`) para generación self-service de API keys compatibles con OpenAI.
- **Frontend & Backend:** React + Vite servido en Nginx y APIs en .NET 10 (con ambientes separados de Producción y QA).
- **Entorno de Despliegue:** Todo el stack orquestado en una **VPS única de 4 GB de RAM** (`<IP_PÚBLICA_VPS>`).

---

## 🛡️ Acciones Tomadas desde el Rol DevOps

### 1. Hardening Perimetral y Hallazgo Crítico de Docker vs UFW
- **Descubrimiento:** Se detectó que Docker inyecta reglas directamente en `iptables`, saltándose `ufw` y exponiendo puertos declarados con `0.0.0.0` a internet. Esto originó un ataque real de fuerza bruta contra el usuario `sa` de SQL Server.
- **Solución implementada:** Se reconfiguraron todos los contenedores para enlazarse exclusivamente a la IP de la red privada **Tailscale** (`<IP_PRIVADA_TAILSCALE>:PUERTO`), eliminando por completo la exposición pública de las 4 bases de datos y paneles administrativos.
- **Auditoría en 3 capas:** Creación de un procedimiento de verificación con `docker ps`, `ss -tulnp` y probing TCP mediante `/dev/tcp`.

### 2. Defensa Activa con CrowdSec y Port Knocking
- **CrowdSec IPS:** Agente en el host con bouncer iptables, protegiendo SSH, Linux y analizando logs de Nginx Proxy Manager (bloqueando ataques SQLi, escaneos `.env`/`.git` y fuerza bruta).
- **Resolución de colisión:** Se movió la API local de CrowdSec del puerto 8080 a `127.0.0.1:8090` para liberar el puerto del frontend.
- **Port Knocking Dinámico:** Script PowerShell `conectar.ps1` que envía golpes a los puertos `7000, 8000, 9000` para abrir temporalmente el puerto SSH (22), lanza la sesión y en background lo vuelve a cerrar con `6000, 5000, 4000`.

### 3. Orquestación y Cuotas de Recursos (4 Bases de Datos en 4 GB RAM)
- Presupuesto de memoria con `mem_limit: 512m` y `cpus: 0.5` por contenedor de base de datos, manteniendo el consumo global del sistema en ~2.3 GB de RAM.
- Rotación estricta de logs en Docker (`max-size: 10m`, `max-file: 3`) para evitar saturación de disco.
- Conexión interna obligatoria mediante nombres DNS de contenedor (ej. `idempotencia-sqlserver`), resolviendo cuelgues por Hairpin NAT.

### 4. Pipelines CI/CD y Control de Versiones
- Flujo de ramas estructurado: `feature/*` → `develop` → `QA` → `main`.
- Reglas de protección de ramas en GitHub con permisos restringidos al equipo `qa-devop`.
- Despliegue continuo automatizado con GitHub Actions mediante port knocking y `docker compose up -d --build`.

### 5. Bitácora de Incidentes Críticos Resueltos
1. **Error 500 en `/auth/register`:** Solucionado cambiando la connection string de IP pública a nombre de contenedor Docker.
2. **Colisión de volumen en SQL Server:** Rescate de datos con backup en caliente T-SQL (`.bak`), exportación de stored procedures y declaración del volumen existente como `external: true`. Cero pérdida de datos.
3. **`appsettings.json` como directorio en Docker:** Purga de imagen en caché y corrección de bind mount.
4. **Permisos de archivos secretos:** Ajuste de permisos Linux `chmod 644` para lectura por el usuario no-root `app`.
5. **Reinicio de NPM por Rate Limiting:** Migración de directivas de limitación a `http_top.conf`.

### 6. Architecture Decision Record (ADR)
- Se evaluó Kubernetes (`k3s`) y se descartó formalmente para evitar el consumo de ~1.2 GB de control plane en una VPS de 4 GB. Se mantuvo Docker Compose optimizado con políticas `restart: unless-stopped`.

---

## 🌟 Contexto del Proyecto: Polaris

**Polaris** es una plataforma integral de orquestación de datos e infraestructura como código construida para resolver el procesamiento del dataset **Olist Brazilian E-Commerce** (clientes, órdenes, pagos, productos, reseñas y logística).

- **Entorno:** Kubernetes ligero (K3s) autoadministrado directamente sobre instancias **AWS EC2** en subred privada aislada, sin el sobrecosto de un clúster gestionado como EKS.
- **Topología Cloud:** VPC `12.0.0.0/16` con subred pública para bastión proxy NGINX Ingress + EIP, y subred privada para control plane y workers K8s detrás de un NAT Gateway.
- **Estructura Desacoplada:** 3 repositorios independientes (`polaris-infrastructure`, `polaris-kubernetes`, `polaris-airflow`).
- **Orquestación ETL:** Apache Airflow con CeleryExecutor, Celery Workers en paralelo, broker RabbitMQ y PostgreSQL analítico.
- **Desacoplamiento Clave con Git-Sync:** Los DAGs no residen en la imagen de contenedor; Kubernetes los sincroniza en tiempo real cada 30 segundos, permitiendo iterar la lógica sin reconstruir ni redesplegar el runtime.

### Acciones Tomadas desde el Rol DevOps / DevSecOps en Polaris
1. **Infraestructura como Código (IaC) con Terraform:** Módulos independientes (`networking`, `compute`, `iam`, `security_groups`), estado remoto cifrado en S3 y forzado estricto de IMDSv2.
2. **Configuración como Código (CaC) con Ansible:** 6 roles automatizados e idempotentes (`k8s_master`, `k8s_worker`, `helm`, `ebs_csi_driver`, `github_runner`, `deploy_key`) para un ciclo de `destroy` + `rebuild` completo en 20-30 minutos.
3. **Networking de Alto Rendimiento con Cilium (eBPF):** CNI moderno para políticas de red y observabilidad sin depender de iptables.
4. **Almacenamiento Persistente AWS EBS CSI Driver:** StorageClass `ebs-sc` sobre volúmenes gp3 encriptados para persistencia de PostgreSQL, RabbitMQ y Prometheus.
5. **DevSecOps Integral en Pipelines:**
   - **Trivy:** Detección de vulnerabilidades críticas y altas en imágenes y manifiestos.
   - **Checkov:** Auditoría estática de seguridad sobre código Terraform y manifiestos renderizados.
   - **Infracost:** Visibilidad y control financiero automatizado en cada Pull Request (~$414 USD/mes).
   - **SonarCloud:** Control de Quality Gate continuo.
   - **Autenticación OIDC:** GitHub Actions federado con AWS IAM sin llaves de acceso estáticas de larga duración.
   - **Versionado Inmutable de Charts:** Fijación estricta de versiones de Helm para prevenir recreaciones destructivas de `volumeClaimTemplates` en StatefulSets.

---

*Para ver la versión web completa e interactiva con simulador de terminal y visores de documentación técnica, abre [index.html](./index.html).*
