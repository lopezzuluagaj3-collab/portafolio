/**
 * Portafolio Personal DevOps — Juan Diego López Zuluaga
 * Lógica interactiva: Router Multi-Vistas (Dashboard vs Visor Docusaurus),
 * Tema (Dark/Light), Simulador de Terminal General, Visor de Documentación y Acordeones.
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRouter();
  initGeneralTerminal();
  initDocViewer();
  initPolarisDocViewer();
  initSiriusDocViewer();
  initNavScroll();
  initMobileMenu();
  initSmoothScrollLinks();
});

/* ==========================================================================
   1. Control de Vistas y Enrutamiento (Dashboard vs Visor Docusaurus)
   ========================================================================== */
function initRouter() {
  window.addEventListener('hashchange', handleRouting);
  handleRouting();

  document.querySelectorAll('[data-view-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetView = link.getAttribute('data-view-target');
      if (targetView) {
        window.location.hash = targetView;
      }
    });
  });
}

function handleRouting() {
  const rawHash = window.location.hash || '#inicio';
  const dashboardView = document.getElementById('view-dashboard');
  const idempView = document.getElementById('view-proyecto-idempotencia');
  const polarisView = document.getElementById('view-proyecto-polaris');
  const siriusView = document.getElementById('view-proyecto-sirius');
  const navDropdownToggle = document.querySelector('.nav__dropdown-toggle');

  // CASO 1: PROYECTO IDEMPOTENCIA
  if (rawHash.startsWith('#proyecto-idempotencia') || rawHash.startsWith('#doc-idempotencia') || rawHash === '#idemp-incidentes') {
    if (dashboardView) dashboardView.classList.remove('active');
    if (polarisView) polarisView.classList.remove('active');
    if (siriusView) siriusView.classList.remove('active');
    if (idempView) idempView.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (navDropdownToggle) {
      navDropdownToggle.innerHTML = `📁 Proyecto: <strong>Idempotencia</strong> ▾`;
    }

    let chapterId = 'resumen-general';
    if (rawHash.includes('/')) {
      chapterId = rawHash.split('/')[1];
    } else if (rawHash === '#idemp-incidentes') {
      chapterId = 'incidentes';
    }

    if (typeof switchDocSection === 'function') {
      switchDocSection(chapterId, false);
    }
    return;
  }

  // CASO 2: PROYECTO POLARIS (KUBERNETES & AWS)
  if (rawHash.startsWith('#proyecto-polaris') || rawHash.startsWith('#doc-polaris')) {
    if (dashboardView) dashboardView.classList.remove('active');
    if (idempView) idempView.classList.remove('active');
    if (siriusView) siriusView.classList.remove('active');
    if (polarisView) polarisView.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (navDropdownToggle) {
      navDropdownToggle.innerHTML = `📁 Proyecto: <strong>Polaris</strong> ▾`;
    }

    let chapterId = 'resumen-general';
    if (rawHash.includes('/')) {
      chapterId = rawHash.split('/')[1];
    }

    if (typeof switchPolarisDocSection === 'function') {
      switchPolarisDocSection(chapterId, false);
    }
    return;
  }

  // CASO 3: PROYECTO SIRIUS (LAKEHOUSE & SPARK EN AWS)
  if (rawHash.startsWith('#proyecto-sirius') || rawHash.startsWith('#doc-sirius')) {
    if (dashboardView) dashboardView.classList.remove('active');
    if (idempView) idempView.classList.remove('active');
    if (polarisView) polarisView.classList.remove('active');
    if (siriusView) siriusView.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (navDropdownToggle) {
      navDropdownToggle.innerHTML = `📁 Proyecto: <strong>Sirius</strong> ▾`;
    }

    let chapterId = 'resumen-general';
    if (rawHash.includes('/')) {
      chapterId = rawHash.split('/')[1];
    }

    if (typeof switchSiriusDocSection === 'function') {
      switchSiriusDocSection(chapterId, false);
    }
    return;
  }

  // CASO 4: DASHBOARD GENERAL (#inicio o ancla interna)
  if (dashboardView) dashboardView.classList.add('active');
  if (idempView) idempView.classList.remove('active');
  if (polarisView) polarisView.classList.remove('active');
  if (siriusView) siriusView.classList.remove('active');

  if (navDropdownToggle) {
    navDropdownToggle.innerHTML = `📁 Proyectos ▾`;
  }

  if (rawHash !== '#inicio' && rawHash !== '') {
    const targetSection = document.querySelector(rawHash);
    if (targetSection) {
      setTimeout(() => {
        const navbarHeight = 78;
        const targetY = Math.max(0, targetSection.getBoundingClientRect().top + window.pageYOffset - navbarHeight);
        smoothScrollTo(targetY, 850, () => highlightSection(targetSection));
      }, 100);
    }
  }
}

/* ==========================================================================
   2. Control de Tema (Dark / Light Mode)
   ========================================================================== */
function initTheme() {
  const themeToggleBtns = document.querySelectorAll('.theme-toggle');
  if (!themeToggleBtns.length) return;

  const currentTheme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  setTheme(currentTheme);

  themeToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);

  const themeIcons = document.querySelectorAll('.theme-icon-slot, #theme-icon');

  themeIcons.forEach(icon => {
    if (theme === 'dark') {
      icon.innerHTML = `
        <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
        <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      `;
      icon.setAttribute('aria-label', 'Cambiar a modo claro');
    } else {
      icon.innerHTML = `
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      `;
      icon.setAttribute('aria-label', 'Cambiar a modo oscuro');
    }
  });
}

/* ==========================================================================
   3. Terminal del Dashboard General (Diagnóstico DevOps)
   ========================================================================== */
const GENERAL_TERMINAL_COMMANDS = {
  'whoami': {
    cmd: 'whoami --profile',
    output: `[USUARIO] Juan Diego López Zuluaga
[ROL] Lead DevOps & Cloud Infrastructure Engineer
[ENFOQUE] Infraestructura como Código, Hardening Perimetral, Contenedores & CI/CD
[FILOSOFÍA] "Seguridad por diseño, contención estricta y eficiencia máxima de recursos."
[LOCALIDAD] Medellín, Colombia | Remoto / Híbrido
[LINKEDIN] https://www.linkedin.com/in/juan-diego-lopez-zuluaga/`
  },
  'skills': {
    cmd: 'cat ~/skills/devops-matrix.yaml',
    output: `iac_and_cloud:
  - Terraform (Módulos networking, compute, iam, security_groups, remote S3 state)
  - Ansible (Configuración como código, roles idempotentes, provisionamiento de nodos)
  - AWS Cloud (VPC, Subnets públicas/privadas, EC2 c7i-flex, NAT Gateway, EBS gp3, OIDC)
containers_and_k8s:
  - Kubernetes (K3s self-managed control plane, workers, node bootstrap, namespaces)
  - Helm 3 (Gestión declarativa de releases, charts upstream, escaneo de rendered manifests)
  - Cilium CNI (Networking eBPF de alto rendimiento, políticas de red L3/L4/L7)
  - Docker & Docker Compose (Multi-stage builds, non-root users, contención estricta)
devsecops_and_quality:
  - Trivy & Checkov (Escaneo de vulnerabilidades críticas/altas en imágenes e IaC)
  - SonarCloud & Hadolint (Quality gates de código y buenas prácticas de Dockerfile)
  - Infracost (Estimación continua de costos en CI/CD)
orquestacion_y_datos:
  - AWS Lakehouse (Glue 4.0 PySpark, Amazon Athena v3, S3 Medallion, Partition Projection)
  - Apache Airflow (CeleryExecutor, Celery workers, RabbitMQ, Git-Sync desacoplado)
  - Business Intelligence (Power BI Desktop, DAX, ODBC Simba, IAM Least Privilege)
  - Bases de Datos (PostgreSQL analítico y metadatos, SQL Server, MySQL, MongoDB)`
  },
  'projects': {
    cmd: 'ls -la ~/proyectos/',
    output: `drwxr-xr-x 5 devop devop 4096 Sep 19 21:00 .
drwxr-xr-x 6 devop devop 4096 Sep 17 17:30 ..
-rwxr-xr-x 1 devop devop 1420 Sep 17 17:50 <span class="highlight-yellow">idempotencia</span> [FUERA DE PRODUCCIÓN] -> DBaaS Multi-Motor (Archivado)
-rwxr-xr-x 1 devop devop 3840 Sep 17 20:00 <span class="highlight-green">polaris</span>      [PRODUCCIÓN]          -> K3s Self-Managed + Cilium + Airflow en AWS
-rwxr-xr-x 1 devop devop 4424 Sep 19 21:00 <span class="highlight-blue" style="color:var(--primary-lighter);">sirius</span>       [PRODUCCIÓN]          -> Modern Data Lakehouse Serverless (PySpark 4.0 + Athena + Power BI)

Usa el menú superior "📁 Proyectos ▾", los botones del catálogo o ejecuta "sirius" para ver telemetría.`
  },
  'sirius': {
    cmd: 'sirius --status --metrics',
    output: `[PROYECTO] Sirius — NYC TLC Modern Data Lakehouse Serverless en AWS
[ESTADO] <span class="highlight-green">[PRODUCCIÓN / ACTIVO]</span>
[ESCALA] ~4,424,189,399 viajes procesados (18 años, 2009 - 2026, 590 Parquets)
[ARQUITECTURA MEDALLION]
  - Row (Bronze):     75.1 GB (590 archivos Parquet originales inmutables)
  - Staging (Silver): 123.2 GB (Snappy Parquet deduplicado, safe cast universal)
  - Mart (Gold):      388.8 MB (4 Data Marts CTAS, reducción analítica del 99.7%)
[COMPUTE SPARK] AWS Glue 4.0 con multithreading en driver (~875,000 filas/seg)
[MOTOR ANALÍTICO] Amazon Athena v3 con Partition Projection (consultas en 2.0s - 3.4s)
[FINOPS AUDITADO]
  - Backfill histórico: $92.30 USD Spark (100% absorbido por créditos promocionales AWS)
  - Mantenimiento recurrente: ~$4.65 USD / mes (2 workers G.1X en Glue + S3)`
  },
  'health': {
    cmd: 'uptime && free -h',
    output: ` 18:20:00 up 42 days, 14:12,  1 user,  load average: 0.38, 0.32, 0.29
               total        used        free      shared  buff/cache   available
Mem:           3.8Gi       2.3Gi       850Mi        48Mi       680Mi       1.4Gi
Swap:          2.0Gi       180Mi       1.8Gi
STATUS: <span class="highlight-green">[HEALTHY / RESILIENTE]</span>`
  }
};

function initGeneralTerminal() {
  const terminalBtns = document.querySelectorAll('.gen-term-btn');
  const terminalCmd = document.getElementById('gen-terminal-cmd');
  const terminalOutput = document.getElementById('gen-terminal-output');

  if (!terminalCmd || !terminalOutput) return;

  terminalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-cmd');
      if (!action || !GENERAL_TERMINAL_COMMANDS[action]) return;

      terminalBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      terminalCmd.textContent = GENERAL_TERMINAL_COMMANDS[action].cmd;
      terminalOutput.innerHTML = GENERAL_TERMINAL_COMMANDS[action].output;
    });
  });

  if (GENERAL_TERMINAL_COMMANDS['whoami']) {
    terminalCmd.textContent = GENERAL_TERMINAL_COMMANDS['whoami'].cmd;
    terminalOutput.innerHTML = GENERAL_TERMINAL_COMMANDS['whoami'].output;
  }
}

/* ==========================================================================
   4. Visor de Documentación Técnica Estilo Docusaurus (Idempotencia)
   ========================================================================== */
const DOC_SECTIONS = [
  { id: 'resumen-general', title: '1. Resumen general', short: 'Resumen general', prev: null, next: 'firewall' },
  { id: 'firewall', title: '2. Firewall — estado actual y hallazgo crítico', short: 'Firewall', prev: 'resumen-general', next: 'acceso-remoto' },
  { id: 'acceso-remoto', title: '3. Acceso remoto', short: 'Acceso remoto', prev: 'firewall', next: 'github' },
  { id: 'github', title: '4. GitHub / control de versiones', short: 'GitHub / control de versiones', prev: 'acceso-remoto', next: 'servicios' },
  { id: 'servicios', title: '5. Servicios desplegados', short: 'Servicios desplegados', prev: 'github', next: 'bases-datos' },
  { id: 'bases-datos', title: '6. Bases de datos', short: 'Bases de datos', prev: 'servicios', next: 'monitoreo' },
  { id: 'monitoreo', title: '7. Monitoreo y seguridad activa', short: 'Monitoreo y seguridad activa', prev: 'bases-datos', next: 'incidentes' },
  { id: 'incidentes', title: '8. Incidentes resueltos (bitácora)', short: 'Incidentes resueltos', prev: 'monitoreo', next: 'backups' },
  { id: 'backups', title: '9. Backups y persistencia', short: 'Backups y persistencia', prev: 'incidentes', next: 'pendientes' },
  { id: 'pendientes', title: '10. Pendientes abiertos', short: 'Pendientes abiertos', prev: 'backups', next: 'kubernetes' },
  { id: 'kubernetes', title: '11. Kubernetes — evaluado y descartado por ahora', short: 'Kubernetes', prev: 'pendientes', next: 'lecciones' },
  { id: 'lecciones', title: '12. Lecciones operativas (referencia rápida)', short: 'Lecciones operativas', prev: 'kubernetes', next: null }
];

function initDocViewer() {
  // Manejador de clics en la barra lateral
  document.querySelectorAll('[data-doc-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-doc-target');
      switchDocSection(targetId);
    });
  });

  // Acordeón de la categoría en la barra lateral
  const categoryBtn = document.getElementById('doc-category-toggle');
  const categoryBox = document.getElementById('doc-category-box');
  if (categoryBtn && categoryBox) {
    categoryBtn.addEventListener('click', () => {
      categoryBox.classList.toggle('collapsed');
    });
  }

  // Paginación anterior / siguiente
  const prevBtn = document.getElementById('doc-pag-prev');
  const nextBtn = document.getElementById('doc-pag-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const targetId = prevBtn.getAttribute('data-target-doc');
      if (targetId) switchDocSection(targetId);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const targetId = nextBtn.getAttribute('data-target-doc');
      if (targetId) switchDocSection(targetId);
    });
  }
}

function switchDocSection(sectionId, updateHash = true) {
  const sectionData = DOC_SECTIONS.find(s => s.id === sectionId);
  if (!sectionData) return;

  // 1. Actualizar barra lateral activa
  document.querySelectorAll('.doc-sidebar__link').forEach(link => {
    if (link.getAttribute('data-doc-target') === sectionId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 2. Mostrar artículo correspondiente
  document.querySelectorAll('.doc-article').forEach(art => {
    if (art.id === `doc-art-${sectionId}`) {
      art.classList.add('active');
    } else {
      art.classList.remove('active');
    }
  });

  // 3. Actualizar migas de pan
  const crumbEl = document.getElementById('doc-breadcrumb-current');
  if (crumbEl) {
    crumbEl.textContent = sectionData.short;
  }

  // 4. Actualizar botones de paginación
  const prevBtn = document.getElementById('doc-pag-prev');
  const nextBtn = document.getElementById('doc-pag-next');

  if (prevBtn) {
    if (sectionData.prev) {
      const prevData = DOC_SECTIONS.find(s => s.id === sectionData.prev);
      prevBtn.style.visibility = 'visible';
      prevBtn.setAttribute('data-target-doc', sectionData.prev);
      prevBtn.querySelector('.doc-pagination__title').textContent = `« ${prevData.short}`;
    } else {
      prevBtn.style.visibility = 'hidden';
    }
  }

  if (nextBtn) {
    if (sectionData.next) {
      const nextData = DOC_SECTIONS.find(s => s.id === sectionData.next);
      nextBtn.style.visibility = 'visible';
      nextBtn.setAttribute('data-target-doc', sectionData.next);
      nextBtn.querySelector('.doc-pagination__title').textContent = `${nextData.short} »`;
    } else {
      nextBtn.style.visibility = 'hidden';
    }
  }

  // 5. Scroll suave al inicio del documento
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 6. Actualizar URL si corresponde
  if (updateHash) {
    history.pushState(null, '', `#doc-idempotencia/${sectionId}`);
  }
}

/* ==========================================================================
   4.1 Visor de Documentación Técnica Estilo Docusaurus (Polaris)
   ========================================================================== */
const POLARIS_DOC_SECTIONS = [
  { id: 'resumen-general', title: 'Polaris — Plataforma ETL sobre Kubernetes', short: 'Resumen General', cat: 'Visión General', catId: 'infra', prev: null, next: 'infra-arquitectura' },
  { id: 'infra-arquitectura', title: '1. Arquitectura y Topología', short: 'Arquitectura y Topología', cat: 'Infraestructura (AWS)', catId: 'infra', prev: 'resumen-general', next: 'infra-metodologia' },
  { id: 'infra-metodologia', title: '2. Metodología de Trabajo', short: 'Metodología', cat: 'Infraestructura (AWS)', catId: 'infra', prev: 'infra-arquitectura', next: 'infra-cicd' },
  { id: 'infra-cicd', title: '3. CI/CD e Infraestructura (IaC)', short: 'CI/CD e IaC', cat: 'Infraestructura (AWS)', catId: 'infra', prev: 'infra-metodologia', next: 'infra-troubleshooting' },
  { id: 'infra-troubleshooting', title: '4. Troubleshooting y Lecciones', short: 'Troubleshooting', cat: 'Infraestructura (AWS)', catId: 'infra', prev: 'infra-cicd', next: 'plat-componentes' },
  { id: 'plat-componentes', title: '1. Arquitectura y Componentes', short: 'Componentes K8s', cat: 'Plataforma (K8s)', catId: 'plat', prev: 'infra-troubleshooting', next: 'plat-decisiones' },
  { id: 'plat-decisiones', title: '2. Decisiones Técnicas', short: 'Decisiones Técnicas', cat: 'Plataforma (K8s)', catId: 'plat', prev: 'plat-componentes', next: 'plat-seguridad' },
  { id: 'plat-seguridad', title: '3. Seguridad y DevSecOps', short: 'Seguridad y DevSecOps', cat: 'Plataforma (K8s)', catId: 'plat', prev: 'plat-decisiones', next: 'plat-cicd' },
  { id: 'plat-cicd', title: '4. CI/CD y Despliegue', short: 'CI/CD y Despliegue', cat: 'Plataforma (K8s)', catId: 'plat', prev: 'plat-seguridad', next: 'datos-flujo' },
  { id: 'datos-flujo', title: '1. Arquitectura y Flujo de Entrega', short: 'Flujo de Entrega', cat: 'Aplicación de Datos', catId: 'datos', prev: 'plat-cicd', next: 'datos-pipeline' },
  { id: 'datos-pipeline', title: '2. Pipeline ETL (Olist)', short: 'Pipeline ETL', cat: 'Aplicación de Datos', catId: 'datos', prev: 'datos-flujo', next: 'datos-modelo' },
  { id: 'datos-modelo', title: '3. Modelo Analítico Estrella', short: 'Modelo Analítico', cat: 'Aplicación de Datos', catId: 'datos', prev: 'datos-pipeline', next: 'datos-operacion' },
  { id: 'datos-operacion', title: '4. CI/CD y Operación en K8s', short: 'Operación en K8s', cat: 'Aplicación de Datos', catId: 'datos', prev: 'datos-modelo', next: null }
];

function initPolarisDocViewer() {
  // Manejador de clics en la barra lateral de Polaris
  document.querySelectorAll('[data-polaris-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-polaris-target');
      switchPolarisDocSection(targetId);
    });
  });

  // Acordeones colapsables para las 3 categorías de Polaris
  const categories = [
    { btn: 'polaris-cat-btn-infra', box: 'polaris-cat-box-infra' },
    { btn: 'polaris-cat-btn-plat', box: 'polaris-cat-box-plat' },
    { btn: 'polaris-cat-btn-datos', box: 'polaris-cat-box-datos' }
  ];

  categories.forEach(({ btn, box }) => {
    const btnEl = document.getElementById(btn);
    const boxEl = document.getElementById(box);
    if (btnEl && boxEl) {
      btnEl.addEventListener('click', () => {
        boxEl.classList.toggle('collapsed');
      });
    }
  });

  // Pestañas del navbar superior de Polaris
  const tabInfra = document.getElementById('polaris-nav-tab-infra');
  const tabPlat = document.getElementById('polaris-nav-tab-plat');
  const tabDatos = document.getElementById('polaris-nav-tab-datos');

  if (tabInfra) tabInfra.addEventListener('click', () => switchPolarisDocSection('infra-arquitectura'));
  if (tabPlat) tabPlat.addEventListener('click', () => switchPolarisDocSection('plat-componentes'));
  if (tabDatos) tabDatos.addEventListener('click', () => switchPolarisDocSection('datos-flujo'));

  // Paginación anterior / siguiente de Polaris
  const prevBtn = document.getElementById('polaris-pag-prev');
  const nextBtn = document.getElementById('polaris-pag-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const targetId = prevBtn.getAttribute('data-target-doc');
      if (targetId) switchPolarisDocSection(targetId);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const targetId = nextBtn.getAttribute('data-target-doc');
      if (targetId) switchPolarisDocSection(targetId);
    });
  }
}

function switchPolarisDocSection(sectionId, updateHash = true) {
  const sectionData = POLARIS_DOC_SECTIONS.find(s => s.id === sectionId);
  if (!sectionData) return;

  // 1. Actualizar barra lateral activa
  document.querySelectorAll('[data-polaris-target]').forEach(link => {
    if (link.getAttribute('data-polaris-target') === sectionId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 2. Asegurar que la categoría correspondiente esté expandida
  if (sectionData.catId) {
    const boxEl = document.getElementById(`polaris-cat-box-${sectionData.catId}`);
    if (boxEl && boxEl.classList.contains('collapsed')) {
      boxEl.classList.remove('collapsed');
    }
  }

  // 3. Mostrar artículo correspondiente
  document.querySelectorAll('#view-proyecto-polaris .doc-article').forEach(art => {
    if (art.id === `polaris-art-${sectionId}`) {
      art.classList.add('active');
    } else {
      art.classList.remove('active');
    }
  });

  // 4. Actualizar migas de pan
  const crumbCat = document.getElementById('polaris-breadcrumb-cat');
  const crumbCur = document.getElementById('polaris-breadcrumb-current');
  if (crumbCat) crumbCat.textContent = sectionData.cat;
  if (crumbCur) crumbCur.textContent = sectionData.short;

  // 5. Actualizar pestañas del navbar superior
  const tabInfra = document.getElementById('polaris-nav-tab-infra');
  const tabPlat = document.getElementById('polaris-nav-tab-plat');
  const tabDatos = document.getElementById('polaris-nav-tab-datos');
  if (tabInfra && tabPlat && tabDatos) {
    tabInfra.classList.toggle('active', sectionData.catId === 'infra');
    tabPlat.classList.toggle('active', sectionData.catId === 'plat');
    tabDatos.classList.toggle('active', sectionData.catId === 'datos');
  }

  // 6. Actualizar botones de paginación
  const prevBtn = document.getElementById('polaris-pag-prev');
  const nextBtn = document.getElementById('polaris-pag-next');

  if (prevBtn) {
    if (sectionData.prev) {
      const prevData = POLARIS_DOC_SECTIONS.find(s => s.id === sectionData.prev);
      prevBtn.style.visibility = 'visible';
      prevBtn.setAttribute('data-target-doc', sectionData.prev);
      prevBtn.querySelector('.doc-pagination__title').textContent = `« ${prevData.short}`;
    } else {
      prevBtn.style.visibility = 'hidden';
    }
  }

  if (nextBtn) {
    if (sectionData.next) {
      const nextData = POLARIS_DOC_SECTIONS.find(s => s.id === sectionData.next);
      nextBtn.style.visibility = 'visible';
      nextBtn.setAttribute('data-target-doc', sectionData.next);
      nextBtn.querySelector('.doc-pagination__title').textContent = `${nextData.short} »`;
    } else {
      nextBtn.style.visibility = 'hidden';
    }
  }

  // 7. Scroll suave al inicio del documento
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 8. Actualizar URL si corresponde
  if (updateHash) {
    history.pushState(null, '', `#doc-polaris/${sectionId}`);
  }
}

/* ==========================================================================
   4.2 Visor de Documentación Técnica Estilo Docusaurus (Sirius)
   ========================================================================== */
const SIRIUS_DOC_SECTIONS = [
  { id: 'resumen-general', title: 'Sirius — Modern Data Lakehouse Serverless en AWS', short: 'Resumen General', cat: 'Visión General', catId: 'arquitectura', prev: null, next: 'ingesta-serverless' },
  { id: 'ingesta-serverless', title: '1. Ingesta Serverless & S3 Row', short: 'Ingesta Serverless', cat: 'Arquitectura & Ingesta', catId: 'arquitectura', prev: 'resumen-general', next: 'cicd-gitops' },
  { id: 'cicd-gitops', title: '2. CI/CD, GitOps & OIDC', short: 'CI/CD & GitOps', cat: 'Arquitectura & Ingesta', catId: 'arquitectura', prev: 'ingesta-serverless', next: 'glue-pyspark' },
  { id: 'glue-pyspark', title: '1. Glue 4.0 & Multithreading', short: 'Glue & PySpark', cat: 'Procesamiento PySpark', catId: 'spark', prev: 'cicd-gitops', next: 'calidad-y-esquema' },
  { id: 'calidad-y-esquema', title: '2. Calidad & Schema Drift', short: 'Calidad & Schema Drift', cat: 'Procesamiento PySpark', catId: 'spark', prev: 'glue-pyspark', next: 'athena-marts' },
  { id: 'athena-marts', title: '1. Athena Marts & Projection', short: 'Athena Marts', cat: 'Capa Gold, FinOps & BI', catId: 'gold', prev: 'calidad-y-esquema', next: 'finops-costos' },
  { id: 'finops-costos', title: '2. FinOps: Auditoría Real', short: 'FinOps & Costos', cat: 'Capa Gold, FinOps & BI', catId: 'gold', prev: 'athena-marts', next: 'powerbi' },
  { id: 'powerbi', title: '3. Power BI & Seguridad IAM', short: 'Power BI & IAM', cat: 'Capa Gold, FinOps & BI', catId: 'gold', prev: 'finops-costos', next: null }
];

function initSiriusDocViewer() {
  // Manejador de clics en la barra lateral de Sirius
  document.querySelectorAll('[data-sirius-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('data-sirius-target');
      switchSiriusDocSection(targetId);
    });
  });

  // Acordeones colapsables para las 3 categorías de Sirius
  const categories = [
    { btn: 'sirius-cat-btn-arquitectura', box: 'sirius-cat-box-arquitectura' },
    { btn: 'sirius-cat-btn-spark', box: 'sirius-cat-box-spark' },
    { btn: 'sirius-cat-btn-gold', box: 'sirius-cat-box-gold' }
  ];

  categories.forEach(({ btn, box }) => {
    const btnEl = document.getElementById(btn);
    const boxEl = document.getElementById(box);
    if (btnEl && boxEl) {
      btnEl.addEventListener('click', () => {
        boxEl.classList.toggle('collapsed');
      });
    }
  });

  // Pestañas del navbar superior de Sirius
  const tabResumen = document.getElementById('sirius-nav-tab-resumen');
  const tabIngesta = document.getElementById('sirius-nav-tab-ingesta');
  const tabSpark = document.getElementById('sirius-nav-tab-spark');
  const tabGold = document.getElementById('sirius-nav-tab-gold');
  const tabFinops = document.getElementById('sirius-nav-tab-finops');

  if (tabResumen) tabResumen.addEventListener('click', () => switchSiriusDocSection('resumen-general'));
  if (tabIngesta) tabIngesta.addEventListener('click', () => switchSiriusDocSection('ingesta-serverless'));
  if (tabSpark) tabSpark.addEventListener('click', () => switchSiriusDocSection('glue-pyspark'));
  if (tabGold) tabGold.addEventListener('click', () => switchSiriusDocSection('athena-marts'));
  if (tabFinops) tabFinops.addEventListener('click', () => switchSiriusDocSection('finops-costos'));

  // Paginación anterior / siguiente de Sirius
  const prevBtn = document.getElementById('sirius-pag-prev');
  const nextBtn = document.getElementById('sirius-pag-next');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const targetId = prevBtn.getAttribute('data-target-doc');
      if (targetId) switchSiriusDocSection(targetId);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const targetId = nextBtn.getAttribute('data-target-doc');
      if (targetId) switchSiriusDocSection(targetId);
    });
  }
}

function switchSiriusDocSection(sectionId, updateHash = true) {
  const sectionData = SIRIUS_DOC_SECTIONS.find(s => s.id === sectionId);
  if (!sectionData) return;

  // 1. Actualizar barra lateral activa
  document.querySelectorAll('[data-sirius-target]').forEach(link => {
    if (link.getAttribute('data-sirius-target') === sectionId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // 2. Asegurar que la categoría correspondiente esté expandida
  if (sectionData.catId) {
    const boxEl = document.getElementById(`sirius-cat-box-${sectionData.catId}`);
    if (boxEl && boxEl.classList.contains('collapsed')) {
      boxEl.classList.remove('collapsed');
    }
  }

  // 3. Mostrar artículo correspondiente
  document.querySelectorAll('#view-proyecto-sirius .doc-article').forEach(art => {
    if (art.id === `sirius-art-${sectionId}`) {
      art.classList.add('active');
    } else {
      art.classList.remove('active');
    }
  });

  // 4. Actualizar migas de pan
  const crumbCat = document.getElementById('sirius-breadcrumb-cat');
  const crumbCur = document.getElementById('sirius-breadcrumb-current');
  if (crumbCat) crumbCat.textContent = sectionData.cat;
  if (crumbCur) crumbCur.textContent = sectionData.short;

  // 5. Actualizar pestañas del navbar superior
  const tabResumen = document.getElementById('sirius-nav-tab-resumen');
  const tabIngesta = document.getElementById('sirius-nav-tab-ingesta');
  const tabSpark = document.getElementById('sirius-nav-tab-spark');
  const tabGold = document.getElementById('sirius-nav-tab-gold');
  const tabFinops = document.getElementById('sirius-nav-tab-finops');

  if (tabResumen && tabIngesta && tabSpark && tabGold && tabFinops) {
    tabResumen.classList.toggle('active', sectionId === 'resumen-general');
    tabIngesta.classList.toggle('active', sectionData.catId === 'arquitectura' && sectionId !== 'resumen-general');
    tabSpark.classList.toggle('active', sectionData.catId === 'spark');
    tabGold.classList.toggle('active', sectionData.catId === 'gold' && sectionId !== 'finops-costos');
    tabFinops.classList.toggle('active', sectionId === 'finops-costos');
  }

  // 6. Actualizar botones de paginación
  const prevBtn = document.getElementById('sirius-pag-prev');
  const nextBtn = document.getElementById('sirius-pag-next');

  if (prevBtn) {
    if (sectionData.prev) {
      const prevData = SIRIUS_DOC_SECTIONS.find(s => s.id === sectionData.prev);
      prevBtn.style.visibility = 'visible';
      prevBtn.setAttribute('data-target-doc', sectionData.prev);
      prevBtn.querySelector('.doc-pagination__title').textContent = `« ${prevData.short}`;
    } else {
      prevBtn.style.visibility = 'hidden';
    }
  }

  if (nextBtn) {
    if (sectionData.next) {
      const nextData = SIRIUS_DOC_SECTIONS.find(s => s.id === sectionData.next);
      nextBtn.style.visibility = 'visible';
      nextBtn.setAttribute('data-target-doc', sectionData.next);
      nextBtn.querySelector('.doc-pagination__title').textContent = `${nextData.short} »`;
    } else {
      nextBtn.style.visibility = 'hidden';
    }
  }

  // 7. Scroll suave al inicio del documento
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 8. Actualizar URL si corresponde
  if (updateHash) {
    history.pushState(null, '', `#doc-sirius/${sectionId}`);
  }
}

/* ==========================================================================
   5. Scroll Activo en Navbar del Dashboard
   ========================================================================== */
function initNavScroll() {
  const navLinks = document.querySelectorAll('.nav__link');
  const sections = document.querySelectorAll('#view-dashboard section[id]');

  window.addEventListener('scroll', () => {
    const dashboardView = document.getElementById('view-dashboard');
    if (!dashboardView || !dashboardView.classList.contains('active')) return;

    let scrollY = window.pageYOffset;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 100;
      const sectionId = current.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  });
}

/* ==========================================================================
   6. Menú Móvil
   ========================================================================== */
function initMobileMenu() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.querySelector('.navbar__nav');

  if (!mobileBtn || !navMenu) return;

  mobileBtn.addEventListener('click', () => {
    const isVisible = navMenu.style.display === 'flex';
    navMenu.style.display = isVisible ? 'none' : 'flex';

    if (!isVisible) {
      navMenu.style.position = 'absolute';
      navMenu.style.top = '72px';
      navMenu.style.left = '0';
      navMenu.style.right = '0';
      navMenu.style.background = 'var(--navbar-bg)';
      navMenu.style.flexDirection = 'column';
      navMenu.style.padding = '1.5rem';
      navMenu.style.borderBottom = '1px solid var(--border)';
      navMenu.style.backdropFilter = 'blur(12px)';
    }
  });

  document.querySelectorAll('.nav__link, .nav__dropdown-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 996 && navMenu) {
        navMenu.style.display = 'none';
      }
    });
  });
}

/* ==========================================================================
   7. Motor de Desplazamiento Suave (Subida y Bajada tipo Inercia / Smooth Glide)
   ========================================================================== */
let isAutoScrolling = false;
let scrollAnimationId = null;

/**
 * Desplaza suavemente la ventana hasta targetY usando aceleración y desaceleración cúbica (easeInOutCubic)
 * Brinda una sensación natural de inercia similar a deslizar con rueda o trackpad de alta gama.
 */
function smoothScrollTo(targetY, baseDuration = 800, onComplete = null) {
  if (scrollAnimationId) {
    cancelAnimationFrame(scrollAnimationId);
  }

  const startY = window.pageYOffset;
  const diff = targetY - startY;

  // Si ya se encuentra en la posición deseada
  if (Math.abs(diff) < 2) {
    window.scrollTo(0, targetY);
    if (onComplete) onComplete();
    return;
  }

  // Duración dinámica según la distancia recorrida (650ms a 1100ms)
  const duration = Math.min(1100, Math.max(650, Math.abs(diff) * 0.42));
  const startTime = performance.now();
  isAutoScrolling = true;

  // Curva cúbica: arranque suave, velocidad crucero progresiva y frenado sedoso
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const root = document.documentElement;
  const prevBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easeInOutCubic(progress);

    window.scrollTo(0, startY + diff * ease);

    if (progress < 1 && isAutoScrolling) {
      scrollAnimationId = requestAnimationFrame(step);
    } else {
      root.style.scrollBehavior = prevBehavior;
      isAutoScrolling = false;
      scrollAnimationId = null;
      if (progress >= 1 && onComplete) onComplete();
    }
  }

  // Interrupción amigable si el usuario interviene durante el desplazamiento
  const handleUserInterruption = () => {
    if (isAutoScrolling) {
      cancelAnimationFrame(scrollAnimationId);
      isAutoScrolling = false;
      scrollAnimationId = null;
      root.style.scrollBehavior = prevBehavior;
      window.removeEventListener('wheel', handleUserInterruption);
      window.removeEventListener('touchmove', handleUserInterruption);
    }
  };

  window.addEventListener('wheel', handleUserInterruption, { passive: true, once: true });
  window.addEventListener('touchmove', handleUserInterruption, { passive: true, once: true });

  scrollAnimationId = requestAnimationFrame(step);
}

/**
 * Resalta suavemente la sección de destino con un halo difuminado elegante
 */
function highlightSection(element) {
  if (!element) return;
  element.classList.remove('section-glow-pulse');
  void element.offsetWidth; // Forzar reflujo para reiniciar la animación
  element.classList.add('section-glow-pulse');
  setTimeout(() => {
    element.classList.remove('section-glow-pulse');
  }, 1600);
}

/**
 * Inicializa la captura de clics en enlaces ancla y el botón flotante para subir
 */
function initSmoothScrollLinks() {
  // 1. Interceptar clics en enlaces con ancla interna (#...)
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href === '#') return;

    // Si apunta al visor de documentación de Idempotencia, Polaris o Sirius
    if (href.startsWith('#proyecto-idempotencia') || href.startsWith('#doc-idempotencia') ||
        href.startsWith('#proyecto-polaris') || href.startsWith('#doc-polaris') ||
        href.startsWith('#proyecto-sirius') || href.startsWith('#doc-sirius')) {
      return; // Dejar que el router active la vista correspondiente
    }

    const dashboardView = document.getElementById('view-dashboard');
    const idempView = document.getElementById('view-proyecto-idempotencia');
    const polarisView = document.getElementById('view-proyecto-polaris');
    const siriusView = document.getElementById('view-proyecto-sirius');

    // Caso A: Estamos dentro de algún visor de documentación y se hace clic en una sección del dashboard
    const isInsideDocViewer = (idempView && idempView.classList.contains('active')) ||
                              (polarisView && polarisView.classList.contains('active')) ||
                              (siriusView && siriusView.classList.contains('active'));

    if (isInsideDocViewer) {
      e.preventDefault();
      if (idempView) idempView.classList.remove('active');
      if (polarisView) polarisView.classList.remove('active');
      if (siriusView) siriusView.classList.remove('active');
      if (dashboardView) dashboardView.classList.add('active');

      const navDropdownToggle = document.querySelector('.nav__dropdown-toggle');
      if (navDropdownToggle) navDropdownToggle.innerHTML = `📁 Proyectos ▾`;

      if (href === '#inicio') {
        history.pushState(null, '', '#inicio');
        smoothScrollTo(0, 750);
      } else {
        const target = document.querySelector(href);
        if (target) {
          history.pushState(null, '', href);
          setTimeout(() => {
            const navbarHeight = 78;
            const targetY = Math.max(0, target.getBoundingClientRect().top + window.pageYOffset - navbarHeight);
            smoothScrollTo(targetY, 850, () => highlightSection(target));
          }, 60);
        }
      }
      return;
    }

    // Caso B: Estamos en el Dashboard
    if (href === '#inicio') {
      e.preventDefault();
      history.pushState(null, '', '#inicio');
      smoothScrollTo(0, 750);
      return;
    }

    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      history.pushState(null, '', href);
      const navbarHeight = 78;
      const targetY = Math.max(0, target.getBoundingClientRect().top + window.pageYOffset - navbarHeight);
      smoothScrollTo(targetY, 850, () => highlightSection(target));
    }
  });

  // 2. Comportamiento del Botón Flotante para Subir Suavemente (Scroll to Top)
  const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
  if (scrollToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 320) {
        scrollToTopBtn.classList.add('visible');
      } else {
        scrollToTopBtn.classList.remove('visible');
      }
    }, { passive: true });

    scrollToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      smoothScrollTo(0, 800);
    });
  }
}

