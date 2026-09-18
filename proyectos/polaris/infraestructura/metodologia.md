---
sidebar_position: 2
title: Metodología
---

# Infraestructura — Metodología de Trabajo

## Terraform: infraestructura declarativa desde el inicio

La capa de infraestructura (VPC, subredes, security groups, IAM, instancias EC2 y EBS) se definió directamente como código con Terraform, organizada en módulos (`networking`, `security_groups`, `iam`, `compute`) para mantener responsabilidades separadas y facilitar la revisión de cada dominio de forma independiente.

## Ansible: aprender la herramienta resolviendo el problema real

Ansible era una herramienta nueva para mí al iniciar Polaris. El reto no era solo aprender su sintaxis, sino que **no tenía claro de antemano todos los requisitos reales de la infraestructura** — qué paquetes, configuraciones y pasos exactos necesitaba un clúster K3s funcional con Cilium, EBS CSI Driver, un runner de GitHub y un Deploy Key, todo autoconfigurado.

El método que seguí para resolver esto fue:

1. **Configurar manualmente primero**: instalé y configuré cada componente directamente sobre las instancias EC2 (K3s, Cilium, el runner, el deploy key), un paso a la vez, hasta llegar a un clúster funcional.
2. **Documentar cada paso validado**: a medida que cada configuración manual funcionaba, la registré con precisión — comandos, archivos tocados, variables necesarias.
3. **Traducir a roles de Ansible (CaC)**: una vez que tenía el "mapa" completo de lo que la infraestructura realmente necesitaba, convertí cada bloque documentado en un role de Ansible idempotente, integrado en `site.yml`.

Esta secuencia (manual → documentado → automatizado) evitó el error común de intentar escribir playbooks de Ansible a ciegas, sin saber aún qué se estaba automatizando. El resultado son 6 roles ordenados en un único playbook (`k8s_master`, `k8s_worker`, `helm`, `ebs_csi_driver`, `github_runner`, `deploy_key`), cada uno correspondiente a un bloque de conocimiento adquirido primero de forma manual.

## Reproducibilidad sin Ansible Vault

Una decisión consciente de diseño: los secretos que necesita Ansible (el PAT de GitHub, la IP del control plane, las credenciales del EBS CSI Driver) se inyectan como variables de entorno vía `lookup('env', ...)`, cargadas desde un archivo `.env` local nunca versionado — en lugar de usar Ansible Vault.

**Trade-off asumido**: se prioriza la reproducibilidad sin intervención manual (no hay que desbloquear un vault en cada ejecución), a cambio de que la protección del secreto depende enteramente de que `.env` nunca se suba a git. Es una decisión válida para un proyecto de portafolio de un solo operador; en un entorno de equipo o productivo, Vault (o un gestor externo de secretos) sería la elección correcta.

## Resultado de la metodología

Gracias a este enfoque, el ciclo completo de `destroy` + `rebuild` de la infraestructura quedó completamente automatizado y es reproducible en **20 a 30 minutos**, una vez que los secretos y variables de entorno están preparados — sin pasos manuales adicionales.
