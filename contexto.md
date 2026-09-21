# 🧠 Contexto Técnico y Arquitectura del Portafolio
> **Documento de Contexto Operativo y Arquitectónico para Asistentes AI (Antigravity / Gemini / Copilot)**  
> **Propietario:** Juan Diego López Zuluaga — DevOps & Cloud Infrastructure Engineer | Medellín, Colombia  
> **Ubicación:** `D:\portafolio`  
> **Última Actualización:** Septiembre 2026  

---

## 📌 1. Misión de este Documento
Este archivo sintetiza la arquitectura, convenciones de código, mapa de proyectos y reglas de desarrollo del portafolio. **Cualquier sesión de IA que trabaje sobre este proyecto debe leer este archivo primero** para entender el funcionamiento global en segundos, evitando escanear recursivamente todo el repositorio y ahorrando miles de tokens de contexto.

---

## 🏛️ 2. Arquitectura de la Aplicación Web

El portafolio es una **Single Page Application (SPA) pura y ligera** desarrollada sin frameworks pesados (Vanilla JS, HTML5 semántico y CSS3 con variables nativas).

### A. Archivos Núcleo:
- [`index.html`](./index.html): El DOM central de la SPA. Contiene la página principal (**`#view-dashboard`**) y los visores integrados de documentación técnica (**`#view-proyecto-<nombre>`**).
- [`styles.css`](./styles.css): Sistema de diseño inspirado en Docusaurus (temas Claro/Oscuro con persistencia en `localStorage`, variables `--primary: #7c3aed`, `--accent: #f97316`, tipografías *Inter* y *JetBrains Mono*, soporte responsivo y estilos para terminal y figuras).
- [`app.js`](./app.js): Lógica interactiva:
  - `initRouter()` / `handleRouting()`: Enrutador por URL hash (`#inicio`, `#especialidades`, `#proyectos`, `#proyecto-<nombre>`, `#doc-<nombre>/<seccion>`).
  - `initDocViewer()`, `initPolarisDocViewer()`, `initSiriusDocViewer()`: Controladores de los visores Docusaurus (acordeones laterales, pestañas de navegación superior, breadcrumbs y paginación anterior/siguiente).
  - `initGeneralTerminal()`: Simulador de terminal interactiva con autocompletado (`Tab`), historial (`↑`/`↓`) y comandos (`help`, `projects`, `idempotencia`, `polaris`, `sirius`, `clear`, `contact`, etc.).
  - `initSmoothScrollLinks()`: Interceptor de scroll suave con excepciones para evitar colisiones con las rutas SPA.
- [`assets/`](./assets/): Logos, iconos SVG, favicon y capturas de evidencia técnica (`assets/img/<proyecto>/`).
- [`proyectos/`](./proyectos/): Estructura modular de documentación en archivos Markdown (`.md` y `_category_.json`) replicando la taxonomía de Docusaurus.

> [!IMPORTANT]
> **REGLA DE ORO DE RENDERIZADO (DOBLE PERSISTENCIA):**
> Para garantizar carga instantánea sin latencia de red ni parsers dinámicos pesados en el cliente, los artículos técnicos de los proyectos existen en dos formas:
> 1. Como archivos modulares Markdown en `proyectos/<nombre-proyecto>/...` (para portabilidad y GitHub).
> 2. Como elementos precompilados `<article id="<proy>-art-<slug>" class="doc-article">` embebidos directamente dentro de [`index.html`](./index.html).
> **Cualquier cambio de texto, código o imagen en la documentación debe reflejarse TANTO en el archivo `.md` como en el `<article>` de `index.html`.**

---

## 📁 3. Mapa de Proyectos Documentados en el Portafolio

| Proyecto | Slug / Hash SPA | Enfoque Tecnológico | Estado | Repositorio Local / Remoto |
| :--- | :--- | :--- | :--- | :--- |
| **⚡ Idempotencia** | `#proyecto-idempotencia` | DBaaS Multi-Motor (Postgres, MySQL, Mongo, Redis), Docker, Tailscale, CrowdSec, Port Knocking, VPS Hardening. | 🟡 Archivado / Fuera de Producción | `D:\idempotencia` |
| **🌟 Polaris** | `#proyecto-polaris` | K8s Self-Managed en AWS, Cilium CNI (eBPF), Hubble Observability, WireGuard mesh, MetalLB, Terraform. | 🟢 Proyecto Completo / AWS | `D:\polaris` |
| **🚕 Sirius** | `#proyecto-sirius` | Modern Data Lakehouse Serverless en AWS (4.42B viajes NYC TLC), PySpark en Glue 4.0, Athena v3 CTAS, S3 Medallion, Power BI. | 🟢 Proyecto Completo / AWS | `D:\sirius\pipeline-sirius-tlc` |

---

## 🚕 4. Ficha Técnica Detallada: Proyecto Sirius (Lakehouse AWS)

- **Dataset:** NYC Taxi & Limousine Commission (18 años: 2009 - 2026, ~4,424M de filas, 590 archivos Parquet).
- **Arquitectura:** Medallion Serverless en Amazon S3 (`sirius-row` crudo 75.1 GB $\rightarrow$ `sirius-staging` limpio 123.2 GB $\rightarrow$ `sirius-mart` capa Gold 388.8 MB).
- **Procesamiento:** AWS Glue PySpark 4.0 con clúster dinámico (60 workers escalables a 2 en mantenimiento), multithreading en driver (`max_workers=4`) y algoritmo *Universal Safe Cast* contra schema drift.
- **Consultas & FinOps:** Amazon Athena Engine v3 con *Partition Projection* (`anio`, `mes`) y sentencias CTAS desacopladas. Consultas analíticas en **~1.2 segundos** escaneando solo **15-45 MB**. Costo mensual recurrente: **~$4.65 USD/mes**.
- **Business Intelligence:** Reporte Power BI ([`sirius-power-bi.pbix`](file:///D:/sirius/pipeline-sirius-tlc/powerbi/sirius-power-bi.pbix), 18 MB en modo Import) con Dark Theme de alto contraste, 12 medidas DAX empresariales y 3 dashboards ejecutivos:
  1. *Página 1: Visión Ejecutiva y Cuota de Mercado (2009 - 2026)* — Disrupción de apps (>80% cuota) y shock COVID-19.
  2. *Página 2: KPIs Financieros y Rendimiento Económico* — Facturación ($84.2B), tarifa base ($18.45) y costo por milla.
  3. *Página 3: Dinámica Espacio-Temporal y Horaria* — Matriz territorial de distritos y curva 24h interactiva con filtros desplegables tipo acordeón.
- **Evidencias Visuales en Portafolio (`assets/img/sirius/`):**
  - Dashboards: `dashboard_1.png`, `dashboard_2.png`, `dashboard_3.png`, `model_view.png`.
  - AWS: `captura_respuesta_athena.png`, `captura_query_athena.png`, `glue_job_metrix.png`, `glue_categority_table.png`, `s3_bukets.png`.

---

## 🎨 5. Convenciones de Estilo y UI/UX

### A. Imágenes y Figuras en Documentación:
Toda imagen técnica dentro de los artículos del visor debe estructurarse con la etiqueta `<figure>` para aprovechar el centrado, bordes redondeados y sombras configuradas en `styles.css`:

```html
<figure>
  <img src="./assets/img/<proyecto>/<nombre_imagen>.png" alt="Descripción accesible">
  <figcaption><strong>Título en Negrita:</strong> Explicación técnica de la evidencia.</figcaption>
</figure>
```

### B. Bloques de Código y Terminal:
- Bloques de código en artículos: `<pre><code>...</code></pre>`.
- Cajas de terminal destacadas: `<div class="terminal-box"><pre>...</pre></div>`.

### C. Alertas y Badges:
- Tags de tecnología: `<span class="project-tag">AWS Glue</span>`, `<span class="project-tag">Terraform</span>`.
- Badges de estado: `<span class="project-badge status-prod">🟢 Proyecto Completo / AWS</span>` o `<span class="project-badge status-archived">🟡 Archivado</span>`.

---

## ⚠️ 6. Reglas Críticas para Agentes y Asistentes de IA

1. **"NO COMMITTEES" (ESTRICTO):**
   - El asistente de IA **NUNCA** debe ejecutar `git commit` ni `git push` automáticamente.
   - Siempre debe presentar las modificaciones realizadas y proveer los bloques de comando PowerShell listos para que Juan Diego los revise y ejecute en su terminal.

2. **Validación de Sintaxis Obligatoria:**
   - Si se edita [`app.js`](./app.js), se debe ejecutar siempre:
     ```powershell
     node -c D:\portafolio\app.js
     ```
     Para asegurar que no existen errores léxicos ni de sintaxis que rompan el enrutador en el navegador.

3. **Unicidad de Identificadores (IDs):**
   - Los IDs de botones, artículos y secciones en `index.html` deben ser únicos. El formato estándar para artículos es: `<proy>-art-<slug>` (ej. `sirius-art-powerbi`, `polaris-art-cilium`).

4. **Navegación Fluida e Integridad del Enrutador:**
   - Al agregar nuevos proyectos o secciones, registrarlos en la lista de exclusión de `initSmoothScrollLinks` en `app.js` para evitar que el interceptor de anclas de la home capture los links del visor.

5. **Idioma y Tono:**
   - Español nativo, tono profesional de ingeniería de software/datos (riguroso, claro, empático y orientado a arquitectura de nivel Enterprise).
