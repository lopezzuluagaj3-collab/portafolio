# Portafolio Profesional DevOps & Cloud Infrastructure — Juan Diego López Zuluaga
> **Repositorio oficial y centralizado que alberga el portafolio integral de todos mis proyectos de ingeniería DevOps, infraestructura Cloud, orquestación en Kubernetes, seguridad perimetral y plataformas de datos.**

Este repositorio **es el portafolio oficial y consolidado de todos mis proyectos** desarrollados como **Lead DevOps & Cloud Infrastructure Engineer**. No corresponde a un proyecto aislado, sino al espacio centralizado donde presento, estructuro y demuestro la totalidad de mis casos de estudio técnicos, arquitecturas de alta disponibilidad, decisiones de diseño (ADRs), pipelines de automatización CI/CD y portales interactivos de documentación técnica profunda.

El portafolio incluye una **aplicación web interactiva de alto impacto visual** ([index.html](./index.html)) construida extrayendo el sistema de diseño (UI/UX) de Docusaurus: paleta violeta (`#7c3aed`) con acentos en degradado coral (`#ff9280`, `#ff6f57`), cuadrícula radial de puntos, efectos glassmorphic, simulación interactiva de terminal Unix, soporte nativo para temas claro/oscuro y un **motor de desplazamiento suave tipo inercia** (`easeInOutCubic`).

---

## 👤 Perfil Profesional y Contacto

- **Ingeniero:** Juan Diego López Zuluaga
- **Rol:** Lead DevOps & Cloud Infrastructure Engineer
- **Ubicación:** Medellín, Colombia (Disponible para proyectos Remotos / Híbridos)
- **Correo Electrónico:** [lopezzuluagaj3@gmail.com](mailto:lopezzuluagaj3@gmail.com)
- **LinkedIn:** [linkedin.com/in/juan-diego-lopez-zuluaga](https://www.linkedin.com/in/juan-diego-lopez-zuluaga/)
- **GitHub:** [@lopezzuluagaj3-collab](https://github.com/lopezzuluagaj3-collab)
- **Teléfono:** +57 300 876 1913

---

## 🚀 Proyectos Consolidados en este Portafolio

```
d:\portafolio\
├── index.html                  # Aplicación Web SPA (Dashboard + Visores Docusaurus)
├── styles.css                  # Sistema de diseño, tokens UI/UX y transiciones
├── app.js                      # Enrutador, motor de scroll inercial y terminal interactiva
├── portafolio.md               # Resumen ejecutivo de acciones DevOps
└── proyectos/                  # Documentación técnica modular por proyecto
    ├── polaris/                # Caso: Kubernetes Self-Managed en AWS + ETL Airflow
    └── idempotencia/           # Caso: DBaaS Multi-Motor & Hardening VPS
```

### 1. 🌟 Polaris — Plataforma ETL sobre Kubernetes Self-Managed en AWS
- **Estado:** 🟢 **En Producción / AWS**
- **Documentación Completa:** [proyectos/polaris/resumen-general.md](./proyectos/polaris/resumen-general.md)
- **Enfoque:** Demostración profunda de dominio de **Kubernetes, Helm 3 y Cilium CNI (eBPF)** en un entorno real de datos sobre AWS, operando un control plane autoadministrado en EC2 sin recurrir al costo de EKS.
- **Aspectos Destacados:**
  - **Topología de Red AWS:** VPC `12.0.0.0/16` aislada con subred pública (Bastión Proxy NGINX Ingress + EIP) y subred privada para el plano de control K3s y workers detrás de NAT Gateway.
  - **Desacoplamiento en 3 Repositorios:** `polaris-infrastructure` (Terraform + Ansible), `polaris-kubernetes` (Helm + Cilium + Ingress + Observabilidad) y `polaris-airflow` (Runtime Docker + DAGs).
  - **Git-Sync:** Los DAGs no residen en la imagen de Airflow; Kubernetes los sincroniza en tiempo real cada 30 segundos, permitiendo iterar la lógica sin downtime ni reconstrucción de imágenes.
  - **DevSecOps en CI/CD:** Escaneos automatizados con **Trivy** (imágenes y manifiestos), **Checkov** (IaC), **SonarCloud** (Quality Gate) y **Infracost** (~$414 USD/mes) mediante GitHub Actions autenticado por **AWS OIDC** (sin credenciales estáticas de larga duración).
  - **Modelo Analítico:** Pipeline ETL que descarga el dataset *Brazilian E-Commerce de Olist*, limpia y normaliza pagos/reseñas, y carga transaccionalmente en un esquema estrella sobre PostgreSQL para visualización en Power BI.

---

### 2. ⚡ Idempotencia — Plataforma DBaaS Multi-Motor & Hardening VPS
- **Estado:** 🟡 **Fuera de Producción / Archivado** (Ciclo de entrega completado)
- **Documentación Completa:** [proyectos/idempotencia/resumen-general.md](./proyectos/idempotencia/resumen-general.md)
- **Enfoque:** Plataforma de autoservicio de bases de datos relacionales y no relacionales con módulo de IA bajo Ollama, operando de forma confinada y resiliente en una única VPS de 4 GB de RAM.
- **Aspectos Destacados:**
  - **Resolución Crítica Docker vs UFW:** Descubrimiento de que Docker bypassea `ufw` al publicar puertos directamente en iptables; mitigación inmediata enlazando servicios exclusivamente a la IP privada de **Tailscale** (`100.99.206.50`).
  - **Defensa Perimetral Activa:** Agente **CrowdSec IPS** con bouncer en iptables para bloquear escaneos y fuerza bruta, sumado a un mecanismo de **Port Knocking Dinámico** vía scripts de PowerShell/Bash.
  - **Cuotas Estrictas de Recursos:** Confinamiento de 4 motores de bases de datos (SQL Server 2022, PostgreSQL 16, MySQL 8.4, MongoDB 7) bajo límites de 512 MB de RAM y 0.5 CPU.
  - **Cero Pérdida de Datos en Incidentes:** Rescate en caliente y migración mediante backup T-SQL ante colisiones de volúmenes de Docker, declarando volúmenes existentes como `external: true`.

---

## 🏛️ Arquitectura de la Aplicación Web del Portafolio

La interfaz de usuario implementada en este repositorio opera como una **Single Page Application (SPA)** nativa con dos tipos de experiencias diferenciadas:

1. **Dashboard Principal (`#inicio`):**
   - Vista ejecutiva y limpia que no se acopla a un único proyecto.
   - Presenta el perfil profesional, métricas clave de infraestructura, pilares de especialidad DevOps y el catálogo interactivo de proyectos.
   - Incluye un simulador de consola interactiva (`whoami`, `skills`, `projects`, `system-health`).

2. **Portales de Documentación Técnica Estilo Docusaurus (`#proyecto-*`):**
   - Al hacer clic en cualquiera de los proyectos (desde el dropdown superior `📁 Proyectos ▾` o desde las tarjetas del catálogo), la web se transforma en un entorno formal de documentación técnica.
   - Cuenta con una barra lateral izquierda con **categorías en acordeones colapsables**, indicador de capítulo activo en lila, migas de pan dinámicas (`🏠 > Proyecto > [Categoría] > [Tema]`), tablas formales, diagramas ASCII y botones de paginación secuencial (`« Anterior` / `Siguiente »`).
   - El botón superior `← Volver al Portafolio` permite regresar fluidamente al Dashboard en cualquier momento.

---

## 💻 Cómo Subir y Bajar el Servicio Localmente

Al ser un desarrollo web estático optimizado, no requiere bases de datos locales ni procesos de compilación complejos.

### 🟢 Subir el Servicio (Iniciar Servidor):
Desde una terminal en la carpeta del repositorio:

```powershell
# Con Python:
cd d:\portafolio
python -m http.server 8085

# Con Node.js (opcional):
npx serve -p 8085
```

Abre tu navegador en: **`http://localhost:8085`**

### 🔴 Bajar el Servicio (Detener Servidor):
- Presiona **`Ctrl + C`** en la ventana de terminal donde se esté ejecutando.
- Si quedó en segundo plano en Windows PowerShell:
  ```powershell
  Get-Process python | Stop-Process -Force
  ```

---

## 📄 Licencia y Reconocimientos

© 2026 Juan Diego López Zuluaga. Desarrollado con dedicación técnica y mejores prácticas de ingeniería DevOps.