---
sidebar_position: 1
title: Resumen General
---

# Idempotencia — Plataforma DBaaS & IA Gateway (VPS 4GB RAM)

> **Estado del Proyecto:** 🟡 **Fuera de Producción / Archivado**  
> La infraestructura activa fue desmantelada al concluir el ciclo de evaluación y entrega académica/técnica. Esta documentación preserva la arquitectura, decisiones de hardening, solución al bypass de Docker sobre UFW y la bitácora operativa de post-mortems.

---

## 📌 ¿Qué fue Idempotencia?

Idempotencia fue un proyecto grupal enfocado en construir una plataforma de **Database-as-a-Service (DBaaS)** autoservicio orientada a desarrolladores, permitiendo aprovisionar instantáneamente bases de datos relacionales y no relacionales sin fricción administrativa:

- **Motores Soportados:** SQL Server 2022, PostgreSQL 16, MySQL 8.4 y MongoDB 7.
- **Módulo de IA:** Gateway con FastAPI y Ollama (`qwen2.5:3b`) para generación self-service de API keys compatibles con OpenAI.
- **Frontend & Backend:** React + Vite servido en Nginx y APIs en .NET 10 (ambientes de Producción y QA).
- **Entorno de Despliegue:** Stack orquestado en una **VPS única de 4 GB de RAM** (`46.224.101.88`).

---

## 🛡️ Mi Rol: Lead DevOps

- **Hardening Perimetral:** Descubrimiento y mitigación crítica del bypass de Docker sobre UFW (aislamiento mediante malla privada Tailscale y port knocking).
- **Defensa Activa:** Configuración de CrowdSec IPS con bouncer iptables y mitigación de fuerza bruta.
- **Orquestación y Cuotas de Recursos:** Confinamiento de 4 motores de bases de datos bajo cuotas de CPU/RAM (`mem_limit: 512m`, `cpus: 0.5`).
- **CI/CD:** Pipelines automatizados de GitHub Actions con port knocking dinámico.
- **Gestión de Incidentes:** Resolución de colisión de volúmenes en SQL Server, Hairpin NAT y migración de configuraciones NPM.

---

## 🗂️ Índice de Decisiones Técnicas (Archivos en este repositorio)

Todos los capítulos detallados se encuentran disponibles en la carpeta [`decisiones-tecnicas/`](./decisiones-tecnicas/):

1. **[1. Resumen General](./decisiones-tecnicas/resumen-general.mdx):** Propósito de la VPS, topología de red y stack.
2. **[2. Firewall e IP Pública](./decisiones-tecnicas/firewall.mdx):** Bypass de Docker sobre UFW y remediación.
3. **[3. Acceso Remoto](./decisiones-tecnicas/acceso-remoto.mdx):** Tailscale VPN y cierre de puertos administrativos.
4. **[4. GitHub y Control de Versiones](./decisiones-tecnicas/github-control-versiones.mdx):** Flujo de ramas y CI/CD.
5. **[5. Servicios Desplegados](./decisiones-tecnicas/servicios-desplegados.mdx):** Inventario de puertos y contenedores.
6. **[6. Bases de Datos](./decisiones-tecnicas/bases-de-datos.mdx):** Inicialización de 4 motores y collations de SQL Server.
7. **[7. Monitoreo y Seguridad Activa](./decisiones-tecnicas/monitoreo-seguridad.mdx):** CrowdSec IPS y bouncers de iptables.
8. **[8. Incidentes Resueltos](./decisiones-tecnicas/incidentes-resueltos.mdx):** Bitácora completa de post-mortems.
9. **[9. Backups y Persistencia](./decisiones-tecnicas/backups-persistencia.mdx):** Estrategia de volúmenes y dumps.
10. **[10. Pendientes Abiertos](./decisiones-tecnicas/pendientes-abiertos.mdx):** Tareas operativas de referencia.
11. **[11. Kubernetes](./decisiones-tecnicas/kubernetes.mdx):** Evaluación y justificación técnica del descarte.
12. **[12. Lecciones Operativas](./decisiones-tecnicas/lecciones-operativas.mdx):** Buenas prácticas de referencia rápida.
