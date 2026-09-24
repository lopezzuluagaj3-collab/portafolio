# Portafolio Profesional DevOps & Cloud Infrastructure — Juan Diego López Zuluaga
> **Repositorio oficial y centralizado que alberga el portafolio integral de todos mis proyectos de ingeniería DevOps, infraestructura Cloud, orquestación en Kubernetes, seguridad perimetral y plataformas de datos.**

Este repositorio **es el portafolio oficial y consolidado de todos mis proyectos** desarrollados como **DevOps & Cloud Infrastructure Engineer**. No corresponde a un proyecto aislado, sino al espacio centralizado donde presento, estructuro y demuestro la totalidad de mis casos de estudio técnicos, arquitecturas de alta disponibilidad, decisiones de diseño (ADRs), pipelines de automatización CI/CD y portales interactivos de documentación técnica profunda.

El portafolio incluye una **aplicación web interactiva de alto impacto visual** ([index.html](./index.html)) construida extrayendo el sistema de diseño (UI/UX) de Docusaurus: paleta violeta (`#7c3aed`) con acentos en degradado coral (`#ff9280`, `#ff6f57`), cuadrícula radial de puntos, efectos glassmorphic, simulación interactiva de terminal Unix, soporte nativo para temas claro/oscuro y un **motor de desplazamiento suave tipo inercia** (`easeInOutCubic`).

---

## 👤 Perfil Profesional y Contacto

- **Ingeniero:** Juan Diego López Zuluaga
- **Rol:** DevOps & Cloud Infrastructure Engineer
- **Ubicación:** Medellín, Colombia (Disponible para proyectos Remotos / Híbridos)
- **Correo Electrónico:** [lopezzuluagaj3@gmail.com](mailto:lopezzuluagaj3@gmail.com)
- **LinkedIn:** [linkedin.com/in/juan-diego-lopez-zuluaga](https://www.linkedin.com/in/juan-diego-lopez-zuluaga/)
- **GitHub:** [@lopezzuluagaj3-collab](https://github.com/lopezzuluagaj3-collab)
- **Teléfono:** +57 300 876 1913

---

## 🚀 Proyectos Consolidados en este Portafolio

```text
d:\portafolio\
├── index.html                  # Dashboard Principal ejecutivo (~519 líneas limpias)
├── styles.css                  # Punto de entrada maestro con @import modular
├── app.js                      # Enrutador agnóstico, terminal interactiva y scroll suave
├── portafolio.md               # Resumen ejecutivo de acciones DevOps
├── css/                        # Arquitectura CSS modularizada y escalable
│   ├── tokens.css              # Variables, paleta violeta/coral y tema oscuro
│   ├── base.css                # Reseteo, contenedores y botones base
│   ├── navbar.css              # Barra de navegación, dropdowns y menú móvil
│   ├── dashboard.css           # Secciones: Hero, Especialidades, Terminal, Cards
│   ├── doc-viewer.css          # Visores Docusaurus: Sidebar, artículos, tablas, código
│   └── responsive.css          # Reglas de adaptabilidad y media queries
└── proyectos/                  # Páginas y documentación técnica modular por proyecto
    ├── idempotencia/           # Caso: DBaaS Multi-Motor & Hardening VPS (index.html dedicado)
    ├── polaris/                # Caso: Kubernetes Self-Managed en AWS (index.html dedicado)
    └── sirius/                 # Caso: Modern Data Lakehouse en AWS (index.html dedicado)
```

### 1. 🌟 Polaris — Plataforma ETL sobre Kubernetes Self-Managed en AWS
- **Estado:** 🟢 **Proyecto Completo / AWS**
- **Documentación Completa:** [proyectos/polaris/index.html](./proyectos/polaris/index.html)
- **Enfoque:** Demostración profunda de dominio de **Kubernetes, Helm 3 y Cilium CNI (eBPF)** en un entorno real de datos sobre AWS, operando un control plane autoadministrado en EC2 sin recurrir al costo de EKS.
- **Aspectos Destacados:**
  - **Cilium eBPF O(1):** Sustitución de `kube-proxy` e `iptables` ($O(N)$) por mapas BPF en el kernel para resolución instantánea sin bloqueos de tabla.
  - **StatefulSets & EBS CSI:** Persistencia con `volumeClaimTemplates` en PostgreSQL y RabbitMQ para evitar colisiones de datos.
  - **Desacoplamiento en 3 Repositorios:** `polaris-infrastructure` (Terraform + Ansible), `polaris-kubernetes` (Helm + Cilium + Ingress + Observabilidad) y `polaris-airflow` (Runtime Docker + DAGs vía Git-Sync).
  - **DevSecOps en CI/CD:** Escaneos automatizados con **Trivy**, **Checkov**, **SonarCloud** e **Infracost** mediante GitHub Actions autenticado por **AWS OIDC**.

---

### 2. 🚕 Sirius — Modern Data Lakehouse Serverless en AWS (NYC TLC)
- **Estado:** 🟢 **Proyecto Completo / AWS**
- **Documentación Completa:** [proyectos/sirius/index.html](./proyectos/sirius/index.html)
- **Enfoque:** Arquitectura Medallion (Bronze/Silver/Gold) procesando más de **18 años de datos (4,424 millones de viajes)** con Apache Spark en AWS Glue 4.0, Athena y Power BI.
- **Aspectos Destacados:**
  - **FinOps & Formato Columnar:** Ahorro >95% en Athena mediante Parquet Snappy particionado y Partition Projection en memoria (consultas en 2.0s - 3.4s).
  - **Throughput Distribuido:** Multithreading en driver de Glue PySpark alcanzando hasta ~875,000 filas/seg.
  - **Zero Trust IaC:** Despliegue con Terraform mediante Remote Backend en S3 con **DynamoDB State Locking**, autenticación GitHub Actions OIDC y Quality Gates con Checkov, SonarCloud e Infracost.

---

### 3. ⚡ Idempotencia — Plataforma DBaaS Multi-Motor & Hardening VPS
- **Estado:** 🟡 **Fuera de Producción / Archivado** (Ciclo de entrega completado)
- **Documentación Completa:** [proyectos/idempotencia/index.html](./proyectos/idempotencia/index.html)
- **Enfoque:** Plataforma de autoservicio de bases de datos relacionales y no relacionales con módulo de IA bajo Ollama, operando de forma confinada y resiliente en una única VPS de 4 GB de RAM.
- **Aspectos Destacados:**
  - **Resolución Crítica Docker vs UFW:** Mitigación del bypass de iptables de Docker enlazando sockets exclusivamente a la interfaz privada de **Tailscale**.
  - **Defensa Perimetral Activa:** Agente **CrowdSec IPS** con bouncer en iptables y mecanismo de **Port Knocking Dinámico**.
  - **Cuotas Estrictas de Recursos:** Confinamiento de 4 motores de bases de datos bajo límites de 512 MB de RAM y 0.5 CPU.

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