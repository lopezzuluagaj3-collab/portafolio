---
sidebar_position: 1
title: Arquitectura y Componentes
---

# Plataforma — Arquitectura y Componentes

Repositorio: `polaris-kubernetes`

## Contexto y objetivo

Polaris Logistics modela un escenario empresarial en el que los pedidos deben procesarse diariamente para generar indicadores antes del inicio de la jornada. El flujo de datos utiliza el **Olist Brazilian E-Commerce Dataset** (clientes, pedidos, productos, vendedores, pagos y reseñas).

Este repositorio concentra la capa de **plataforma**: Kubernetes, Helm, networking, servicios, seguridad y observabilidad — construida sobre la infraestructura provista por `polaris-infrastructure` y consumida por el código de datos de `polaris-airflow`.

## Componentes desplegados

| Componente | Implementación | Propósito |
|---|---|---|
| Orquestación ETL | Apache Airflow, CeleryExecutor | Programar y coordinar DAGs |
| Ejecución distribuida | Celery Workers | Ejecutar tareas ETL en paralelo |
| Mensajería | RabbitMQ | Broker para Celery |
| Persistencia | PostgreSQL | Metadatos de Airflow y warehouse analítico |
| Networking | Cilium | CNI basado en eBPF y políticas de red |
| Entrada | ingress-nginx | Exponer servicios HTTP/HTTPS |
| Certificados | cert-manager + Let's Encrypt | Emitir y renovar certificados TLS automáticamente |
| Observabilidad | kube-prometheus-stack | Prometheus, Grafana, Alertmanager y exporters |
| Empaquetado | Helm | Configurar y versionar releases |

## Namespaces por dominio

Los workloads se organizan en tres namespaces: `airflow`, `data` y `monitoring`. Esta separación facilita permisos, troubleshooting, políticas de red y lectura operativa del clúster — un problema en la capa de datos nunca se confunde visualmente con uno de observabilidad o de orquestación.

## Almacenamiento persistente

PostgreSQL, RabbitMQ, Prometheus y Grafana solicitan almacenamiento persistente mediante la StorageClass `ebs-sc`, provista por el EBS CSI Driver instalado desde la capa de infraestructura. RabbitMQ y la observabilidad declaran tamaños y límites de recursos explícitos para hacer visible el comportamiento esperado del ambiente — nada de límites implícitos que sorprendan en producción.
