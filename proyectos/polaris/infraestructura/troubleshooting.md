---
sidebar_position: 4
title: Troubleshooting y Lecciones
---

# Infraestructura — Troubleshooting y Lecciones Aprendidas

Estos son los problemas reales encontrados durante los múltiples ciclos de `destroy`/`rebuild` de Polaris, junto con su causa raíz y la solución aplicada. Se agrupan por dominio para facilitar la referencia.

## Kubernetes y Cilium

| Síntoma | Causa | Fix |
|---|---|---|
| `kubectl get node` pide sudo o falla con permission denied | `kubectl` es symlink a `k3s`, que ignora `~/.kube/config` salvo que `KUBECONFIG` esté exportado | Exportar `KUBECONFIG=$HOME/.kube/config`; en tareas de Ansible con `become_user`, declarar `environment: {KUBECONFIG: ...}` explícitamente (no heredan `.bashrc`) |
| `"cilium" has no deployed releases` al hacer upgrade | Clúster nuevo sin instalación previa de Cilium | Separar tareas de install/upgrade condicionadas por `helm status cilium -n kube-system`, no por `cilium status` (que refleja salud, no existencia) |
| `cannot reuse a name that is still in use` al instalar Cilium | El release de Helm ya existía, pero `cilium status` dio error por un estado momentáneamente no saludable | Usar `helm status` para el chequeo de existencia, no `cilium status` |
| Workers en `NotReady` indefinidamente, puerto `10250: Connection refused` | `K3S_URL` en el join del worker sin puerto explícito | Agregar `:6443` explícito en la URL de join |
| Workers no se unen tras un rebuild aunque el token es correcto | IP del control plane hardcodeada, pero Terraform asigna IPs nuevas en cada `apply` | Centralizar la IP en una sola variable (`k3s_control_plane_ip`, vía `.env`/`IP_PANEL`) en vez de repetirla en cada tarea |

## Ansible

| Síntoma | Causa | Fix |
|---|---|---|
| `hostvars[...]['ansible_host'] undefined` | El inventario no define `ansible_host`; la conexión SSH depende de `ansible_ssh_config` por alias | No usar `ansible_host` para las IPs de K8s (rompe el `ProxyJump`); usar variables de entorno o una variable custom en su lugar |
| Role existe pero nunca se ejecuta (pasó dos veces: `github_runner` y luego `ebs_csi_driver`) | El role no está referenciado en ningún play de `site.yml` | Antes de asumir que un role "no funciona", confirmar que `site.yml` lo invoque en algún play |
| `ansible-playbook site.yml --tags <role>` no ejecuta ninguna tarea real | Las tareas del role no tienen `tags:` asignados explícitamente | Correr el playbook completo sin `--tags` para forzar la re-ejecución (las tareas ya son idempotentes) |
| `sudo: interactive authentication is required` en una tarea `delegate_to: localhost` | La tarea hereda `become: true` del play y pide sudo en la máquina de control, no en el servidor remoto | Agregar `become: false` explícito en tareas delegadas a localhost que no lo necesiten |
| Variables (`IP_PANEL`, `GITHUB_PAT`, etc.) llegan vacías a Ansible sin error explícito | `set -a; source .env; set +a` solo exporta variables en esa sesión de terminal; otra pestaña/sesión no las tiene | Recordar recargar `.env` en cada sesión nueva antes de correr `ansible-playbook` |

## GitHub Actions Runner y Deploy Key

| Síntoma | Causa | Fix |
|---|---|---|
| Runner queda "offline" tras registrarse | Tarea duplicada de `config.sh` en el role (una con token dinámico correcto, otra con variable inexistente) | Eliminar la tarea duplicada; verificar que `site.yml` invoque el role |
| `403 Resource not accessible by personal access token` al pedir el token de registro | PAT sin el permiso `Administration: Read and write` sobre el repo | Ajustar permisos del PAT (fine-grained) o usar scope `repo` completo (classic) |
| `Invalid header value b'Bearer ...\r'` | `.env` con terminadores CRLF (típico al editar desde Windows/VS Code en carpetas montadas) | `sed -i 's/\r$//' .env`; agregar `\| trim` al `lookup('env', ...)` en Ansible como defensa adicional |
| Deploy Key generado pero `git clone` falla con `Permission denied (publickey)` | La tarea de registro del deploy key tenía `when: deploy_keypair.changed`; en una corrida posterior la llave ya existía y el registro se saltó | Quitar el `when` de la tarea de registro (es idempotente por su propio `status_code: [201, 422]`) |
| Job de CI/CD queda en "Skipped" al correrlo manualmente | El `if:` del job no incluye `github.event_name == 'workflow_dispatch'` | Agregar esa condición si se quiere poder disparar manualmente |
| Job de CI/CD se queda esperando indefinidamente sin runner | `runs-on: [self-hosted, <label>]` no coincide con los labels reales del runner registrado | Alinear `runs-on` en el workflow con `github_runner_labels` del role de Ansible |
| `kubectl apply` falla con permission denied desde el propio runner | El runner corre como servicio systemd y no hereda `KUBECONFIG` de ningún shell interactivo | Declarar `KUBECONFIG=/home/ubuntu/.kube/config` en `actions-runner/.env` (el propio actions-runner lo lee al arrancar) |

## Almacenamiento (EBS CSI Driver)

| Síntoma | Causa | Fix |
|---|---|---|
| EBS CSI controller en `CrashLoopBackOff`, log `no EC2 IMDS role found` | El Secret `aws-secret` en `kube-system` estaba vacío (variables de entorno no exportadas en la sesión donde corrió Ansible) | Confirmar `echo "$EBS_CSI_KEY_ID"` antes de correr el playbook |
| `helm upgrade --install` falla con `another operation is in progress` | Una corrida anterior se interrumpió (Ctrl+C) mientras Helm esperaba `--wait`, dejando el release en `pending-upgrade` | `helm uninstall aws-ebs-csi-driver -n kube-system` y reinstalar limpio |
| PVC de prueba (smoke test) nunca pasa a `Bound` | El StorageClass usa `volumeBindingMode: WaitForFirstConsumer`; un PVC sin pod que lo consuma nunca se bindea (comportamiento esperado) | No usar un PVC aislado como smoke test con este binding mode; validar con un PVC real consumido por un pod |

## DNS y Certificados TLS

| Síntoma | Causa | Fix |
|---|---|---|
| Certificado TLS (cert-manager) se queda en `READY: False` indefinidamente | El dominio DNS no resuelve a la IP pública actual, o el puerto 80 no es alcanzable para el challenge HTTP-01 | Validar en orden: `nslookup` → `curl -I` al puerto 80 → `kubectl describe certificate` → revisar el Security Group del proxy |

## Principio general que se repite

La lección transversal más repetida en este proyecto: **un role o una tarea de Ansible puede estar perfectamente escrita y aun así no ejecutarse nunca**, simplemente porque no está referenciada en el playbook principal (`site.yml`). Antes de depurar la lógica interna de un role, siempre vale la pena confirmar primero que efectivamente se está invocando.
