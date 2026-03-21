# Observability Platform — Docker Build & Deployment Guide

> **Version:** 1.0
> **Date:** 2026-03-21
> **Deployment:** All services containerized via Docker Compose on Ubuntu

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Prerequisites](#2-prerequisites)
3. [Repository Structure](#3-repository-structure)
4. [Quick Start](#4-quick-start)
5. [Detailed Setup](#5-detailed-setup)
6. [Build](#6-build)
7. [Deploy](#7-deploy)
8. [Accessing Services](#8-accessing-services)
9. [Environment Variables](#9-environment-variables)
10. [Health Checks](#10-health-checks)
11. [Logs & Debugging](#11-logs--debugging)
12. [Scaling & Updates](#12-scaling--updates)
13. [Backup & Restore](#13-backup--restore)
14. [Production Hardening](#14-production-hardening)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Architecture

All services run as Docker containers on a single Ubuntu VM, orchestrated by Docker Compose.

```
                          ┌──────────────────────────────────────────────┐
                          │              Ubuntu VM                       │
                          │                                              │
    Internet ──► :80 ─────┤  ┌──────────┐                               │
                          │  │ Frontend  │ (Nginx + React SPA)           │
                          │  │  :80      │                               │
                          │  └────┬──────┘                               │
                          │       │ reverse proxy                        │
                          │       ▼                                      │
                          │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐
                          │  │ user-mgmt│ │ apm-svc │ │ apm-rpt  │ │ apm-ai-svc │
                          │  │  :8081   │ │  :8082  │ │  :8084   │ │   :8085    │
                          │  └────┬─────┘ └────┬────┘ └────┬─────┘ └─────┬──────┘
                          │       │            │           │             │
                          │       ▼            ▼           ▼             ▼
                          │  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐
                          │  │ Postgres │ │ Redis  │ │  Elastic │ │ py-sidecar│
                          │  │  :5432   │ │ :6379  │ │  :9200   │ │  :50051   │
                          │  └──────────┘ └────────┘ └──────────┘ └───────────┘
                          │                                              │
                          │  ┌──────────┐ ┌────────┐ ┌──────────┐       │
                          │  │Prometheus│ │ Jaeger │ │OTel Coll.│       │
                          │  │  :9090   │ │ :16686 │ │:4317/4318│       │
                          │  └──────────┘ └────────┘ └──────────┘       │
                          └──────────────────────────────────────────────┘
```

### Container Inventory

| Container | Image | Port | Type |
|-----------|-------|------|------|
| obs-frontend | obs/frontend | 80 | Application |
| obs-user-management | obs/user-management-service | 8081 | Application |
| obs-apm | obs/apm-service | 8082 | Application |
| obs-apm-report | obs/apm-report-service | 8084 | Application |
| obs-apm-ai | obs/apm-ai-service | 8085 | Application |
| obs-python-sidecar | obs/python-sidecar | 50051 | Application |
| obs-postgres | postgres:15-alpine | 5432 | Infrastructure |
| obs-redis | redis:7-alpine | 6379 | Infrastructure |
| obs-elasticsearch | elasticsearch:8.15.0 | 9200 | Infrastructure |
| obs-prometheus | prom/prometheus | 9090 | Infrastructure |
| obs-jaeger | jaegertracing/all-in-one | 16686 | Infrastructure |
| obs-otel-collector | otel/opentelemetry-collector-contrib | 4317, 4318 | Infrastructure |
| obs-mailhog | mailhog/mailhog | 1025, 8025 | Infrastructure |

---

## 2. Prerequisites

### Minimum Server Specs

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| vCPU | 8 cores | 16 cores |
| RAM | 16 GB | 32 GB |
| Disk | 100 GB SSD | 200 GB SSD |

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 24+ | Container runtime |
| Docker Compose | v2+ | Container orchestration |
| Git | 2.x | Clone repository |
| curl | any | Health checks |

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

### Kernel Configuration (Required for Elasticsearch)

```bash
# Set vm.max_map_count (required by Elasticsearch)
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

---

## 3. Repository Structure

```
observability/
├── backend/
│   ├── Dockerfile                      # Multi-stage Dockerfile for all Java services
│   ├── .dockerignore
│   ├── pom.xml                         # Parent POM (Java 25, Spring Boot 3.5.7)
│   ├── mvnw / mvnw.cmd                # Maven wrapper
│   ├── observability-shared/           # Shared library (DTOs, exceptions, logging)
│   ├── user-management-service/        # Auth, RBAC, JWT (port 8081)
│   ├── apm-service/                    # APM, metrics, logs, traces (port 8082)
│   ├── apm-report-service/             # Reports, synthetic monitoring (port 8084)
│   └── apm-ai-service/                 # AI capabilities (port 8085)
│       └── python-sidecar/
│           ├── Dockerfile              # Python gRPC sidecar (port 50051)
│           ├── requirements.txt
│           └── server.py
├── frontend/
│   ├── Dockerfile                      # Multi-stage: Node build → Nginx serve
│   ├── .dockerignore
│   ├── nginx.conf                      # Nginx config with API reverse proxy
│   ├── package.json
│   └── src/
├── deploy/
│   ├── build.sh                        # Build script for Docker images
│   ├── deploy.sh                       # Deployment & management script
│   ├── prometheus.yml                  # Prometheus scrape config
│   └── otel-collector-config.yml       # OpenTelemetry Collector pipeline
├── docs/
│   ├── setup.md                        # ← You are here
│   ├── ubuntu-deployment-plan.md       # Non-Docker deployment plan
│   └── observability-platform-hld.md   # High-Level Design
├── docker-compose.yml                  # Full stack compose file
├── .env.example                        # Environment variable template
└── .gitignore
```

---

## 4. Quick Start

For those who want to get up and running fast:

```bash
# 1. Clone the repo
git clone <REPO_URL> /opt/observability
cd /opt/observability

# 2. Create .env from template
cp .env.example .env
nano .env    # Edit with your values (at minimum: JWT_SECRET, OPENAI_API_KEY)

# 3. Set kernel param for Elasticsearch
sudo sysctl -w vm.max_map_count=262144

# 4. Build all images
chmod +x deploy/build.sh deploy/deploy.sh
./deploy/build.sh

# 5. Deploy everything
./deploy/deploy.sh up

# 6. Verify
./deploy/deploy.sh health
```

The platform is now accessible at `http://<YOUR_SERVER_IP>`.

---

## 5. Detailed Setup

### 5.1 Clone Repository

```bash
sudo mkdir -p /opt/observability
sudo chown $USER:$USER /opt/observability
git clone <REPO_URL> /opt/observability
cd /opt/observability
```

### 5.2 Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```bash
# Required changes:
JWT_SECRET=<generate-with: openssl rand -base64 64>
OPENAI_API_KEY=sk-your-actual-key
DB_PASSWORD=<strong-password>
```

### 5.3 Firewall Configuration

```bash
# Allow HTTP traffic
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # Frontend (public)
sudo ufw allow 443/tcp   # HTTPS (if TLS configured)
sudo ufw enable
```

---

## 6. Build

### 6.1 Build Script Usage

```bash
chmod +x deploy/build.sh

# Build everything
./deploy/build.sh

# Build only backend services
./deploy/build.sh backend

# Build only frontend
./deploy/build.sh frontend

# Build a specific service
./deploy/build.sh user-management-service
./deploy/build.sh apm-service
./deploy/build.sh apm-report-service
./deploy/build.sh apm-ai-service
./deploy/build.sh python-sidecar
```

### 6.2 How Backend Build Works

The backend uses a single multi-stage `Dockerfile` at `backend/Dockerfile`:

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Builder (eclipse-temurin:25-jdk-alpine)            │
│                                                             │
│  1. Copy pom.xml files → download dependencies (cached)     │
│  2. Copy source code                                        │
│  3. Build observability-shared (mvn install)                 │
│  4. Build target service (mvn package) via SERVICE_NAME arg  │
│  5. Output: target/<service>-1.0.0-SNAPSHOT.jar              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Runtime (eclipse-temurin:25-jre-alpine)            │
│                                                             │
│  1. Copy fat JAR from builder stage                         │
│  2. Run as non-root user (appuser)                          │
│  3. Configurable via JAVA_OPTS and SPRING_PROFILES_ACTIVE   │
└─────────────────────────────────────────────────────────────┘
```

The same Dockerfile builds all 4 Java services — the `SERVICE_NAME` build arg selects which one.

### 6.3 How Frontend Build Works

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Builder (node:20-alpine)                           │
│                                                             │
│  1. npm ci (install dependencies)                           │
│  2. npm run build (TypeScript compile + Vite production)    │
│  3. Output: dist/ directory                                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Runtime (nginx:1.27-alpine)                        │
│                                                             │
│  1. Copy dist/ to /usr/share/nginx/html                     │
│  2. Custom nginx.conf with:                                 │
│     - API reverse proxy to backend services                 │
│     - SPA fallback (try_files → /index.html)                │
│     - Gzip compression                                      │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Verify Built Images

```bash
docker images --filter "reference=obs/*"
```

Expected output:

```
REPOSITORY                    TAG       SIZE
obs/frontend                  latest    ~25 MB
obs/user-management-service   latest    ~350 MB
obs/apm-service               latest    ~360 MB
obs/apm-report-service        latest    ~355 MB
obs/apm-ai-service            latest    ~340 MB
obs/python-sidecar            latest    ~450 MB
```

---

## 7. Deploy

### 7.1 Deploy Script Usage

```bash
chmod +x deploy/deploy.sh

# Start everything (infra + services + frontend)
./deploy/deploy.sh up

# Start infrastructure only (DB, Redis, ES, Prometheus, Jaeger)
./deploy/deploy.sh infra

# Start application services only (after infra is healthy)
./deploy/deploy.sh services

# Stop everything
./deploy/deploy.sh down

# Restart all
./deploy/deploy.sh restart

# Check container status
./deploy/deploy.sh status

# Run health checks
./deploy/deploy.sh health

# Tail logs
./deploy/deploy.sh logs                    # All containers
./deploy/deploy.sh logs obs-apm            # Specific container

# Stop everything and delete all data
./deploy/deploy.sh clean
```

### 7.2 Startup Order

Docker Compose handles dependency ordering via `depends_on` with health checks:

```
Phase 1 (Infrastructure — parallel):
  postgres ─────────┐
  redis ────────────┤
  elasticsearch ────┤
  prometheus ───────┤
  mailhog ──────────┘
                    │
Phase 2 (depends on infrastructure health):
  jaeger ───────────── (needs elasticsearch)
  otel-collector ───── (needs jaeger, prometheus, elasticsearch)
                    │
Phase 3 (Backend — sequential):
  user-management-service ────── (needs postgres, elasticsearch)
       │
  apm-service ────────────────── (needs postgres, redis, elasticsearch, user-mgmt)
       │
  ├── apm-report-service ─────── (needs postgres, redis, apm-service)
  │
  ├── python-sidecar ──────────── (no DB deps)
  │        │
  └── apm-ai-service ─────────── (needs postgres, python-sidecar, apm-service)
                    │
Phase 4 (Frontend):
  frontend ──────────────────── (needs user-mgmt, apm-service)
```

### 7.3 Manual Docker Compose Commands

If you prefer using Docker Compose directly:

```bash
# Start everything
docker compose --env-file .env up -d

# Start only infrastructure
docker compose --env-file .env up -d postgres redis elasticsearch prometheus jaeger otel-collector mailhog

# Start only backend services
docker compose --env-file .env up -d user-management-service apm-service apm-report-service python-sidecar apm-ai-service

# Rebuild and restart a single service
docker compose --env-file .env up -d --build apm-service

# View logs
docker compose logs -f apm-service

# Stop everything
docker compose down

# Stop and remove volumes
docker compose down -v
```

---

## 8. Accessing Services

### 8.1 Public Endpoints

| URL | Service |
|-----|---------|
| `http://<IP>/` | Frontend (React SPA) |
| `http://<IP>/api/v1/auth/login` | Login endpoint |
| `http://<IP>/api/v1/services` | Service catalog |
| `http://<IP>/api/v1/metrics/*` | Metrics endpoints |
| `http://<IP>/api/v1/logs/*` | Log endpoints |
| `http://<IP>/api/v1/traces/*` | Trace endpoints |
| `http://<IP>/api/v1/dashboards/*` | Dashboard endpoints |
| `http://<IP>/api/v1/reports/*` | Report endpoints |
| `http://<IP>/api/v1/ai/*` | AI endpoints |

### 8.2 Internal Endpoints (from server only)

| URL | Service |
|-----|---------|
| `http://localhost:9090` | Prometheus UI |
| `http://localhost:16686` | Jaeger UI |
| `http://localhost:8025` | MailHog UI |
| `http://localhost:8081/swagger-ui.html` | User Management Swagger |
| `http://localhost:8082/swagger-ui.html` | APM Service Swagger |
| `http://localhost:8084/swagger-ui.html` | Report Service Swagger |
| `http://localhost:8085/swagger-ui.html` | AI Service Swagger |

### 8.3 API Routing Map

The frontend Nginx container routes API calls to the correct backend service:

| Path Prefix | Target Service | Port |
|-------------|---------------|------|
| `/api/v1/auth/`, `/api/v1/users/`, `/api/v1/roles/`, `/api/v1/permissions/` | user-management-service | 8081 |
| `/api/v1/services/`, `/api/v1/metrics/`, `/api/v1/logs/`, `/api/v1/traces/`, `/api/v1/sla-rules/`, `/api/v1/alerts/`, `/api/v1/alert-channels/`, `/api/v1/dashboards/`, `/api/v1/workflows/`, `/api/v1/dependencies/`, `/api/v1/web-vitals/` | apm-service | 8082 |
| `/api/v1/reports/`, `/api/v1/report-schedules/`, `/api/v1/synthetic-checks/` | apm-report-service | 8084 |
| `/api/v1/ai/` | apm-ai-service | 8085 |
| `/api/*` (fallback) | user-management-service | 8081 |
| `/*` (everything else) | Static files (React SPA) | — |

---

## 9. Environment Variables

### 9.1 Complete Reference

| Variable | Default | Used By | Description |
|----------|---------|---------|-------------|
| `IMAGE_TAG` | `latest` | All | Docker image tag |
| `DB_NAME` | `mydatabase` | All backend | PostgreSQL database |
| `DB_USERNAME` | `myuser` | All backend | PostgreSQL user |
| `DB_PASSWORD` | `mypassword` | All backend | PostgreSQL password |
| `REDIS_PASSWORD` | _(empty)_ | apm, report | Redis password |
| `JWT_SECRET` | _(base64)_ | All backend | Shared JWT signing key |
| `LLM_PROVIDER` | `openai` | ai, sidecar | LLM provider (openai/anthropic) |
| `OPENAI_API_KEY` | _(required)_ | ai, sidecar | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | ai, sidecar | OpenAI model |
| `ANTHROPIC_API_KEY` | _(empty)_ | ai, sidecar | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | ai, sidecar | Anthropic model |
| `ML_SIDECAR_TIMEOUT` | `30000` | ai | gRPC timeout (ms) |
| `REPORT_RETENTION_DAYS` | `30` | report | Report cleanup age |
| `REPORT_EMAIL_FROM` | `reports@...` | report | Report sender email |

### 9.2 Service-Internal Variables (set in docker-compose.yml)

These are configured within `docker-compose.yml` and resolve via Docker networking. You typically do not need to change them:

| Variable | Value | Notes |
|----------|-------|-------|
| `DB_HOST` | `postgres` | Docker service name |
| `REDIS_HOST` | `redis` | Docker service name |
| `ELASTICSEARCH_URI` | `http://elasticsearch:9200` | Docker service name |
| `PROMETHEUS_URL` | `http://prometheus:9090` | Docker service name |
| `JAEGER_QUERY_URL` | `http://jaeger:16686` | Docker service name |
| `ML_SIDECAR_HOST` | `python-sidecar` | Docker service name |
| `SMTP_HOST` | `mailhog` | Docker service name |

---

## 10. Health Checks

### 10.1 Automated Health Check

```bash
./deploy/deploy.sh health
```

Expected output:

```
=== Infrastructure Health ===
  PostgreSQL:    OK
  Redis:         PONG
  Elasticsearch: green
  Prometheus:    OK
  Jaeger:        OK
  MailHog:       OK

=== Application Services ===
  user-management (:8081): UP
  apm-service     (:8082): UP
  apm-report      (:8084): UP
  apm-ai          (:8085): UP

  Frontend (:80): OK
```

### 10.2 Manual Health Checks

```bash
# Infrastructure
docker exec obs-postgres pg_isready -U myuser -d mydatabase
docker exec obs-redis redis-cli ping
curl -s http://localhost:9200/_cluster/health | python3 -m json.tool
curl -s http://localhost:9090/-/healthy

# Backend services
curl -s http://localhost:8081/actuator/health | python3 -m json.tool
curl -s http://localhost:8082/actuator/health | python3 -m json.tool
curl -s http://localhost:8084/actuator/health | python3 -m json.tool
curl -s http://localhost:8085/actuator/health | python3 -m json.tool

# Frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:80

# End-to-end test
curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 10.3 Prometheus Targets

```bash
# Verify all scrape targets are UP
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import sys, json
data = json.load(sys.stdin)
for group in data['data']['activeTargets']:
    print(f\"  {group['labels']['job']}: {group['health']}\")
"
```

---

## 11. Logs & Debugging

### 11.1 View Logs

```bash
# All containers
docker compose logs -f

# Specific service
docker compose logs -f obs-apm
docker compose logs -f obs-user-management

# Last 100 lines
docker compose logs --tail=100 obs-apm

# Since a specific time
docker compose logs --since="2026-03-21T10:00:00" obs-apm
```

### 11.2 Shell into a Container

```bash
# Java service
docker exec -it obs-apm /bin/sh

# PostgreSQL
docker exec -it obs-postgres psql -U myuser -d mydatabase

# Redis
docker exec -it obs-redis redis-cli

# Elasticsearch
docker exec -it obs-elasticsearch bash
```

### 11.3 Resource Usage

```bash
# Real-time resource usage
docker stats

# Specific container
docker stats obs-apm obs-elasticsearch obs-postgres
```

---

## 12. Scaling & Updates

### 12.1 Update a Single Service

```bash
# Pull latest code
cd /opt/observability
git pull

# Rebuild only the changed service
./deploy/build.sh apm-service

# Restart only that service (zero-downtime with health check)
docker compose --env-file .env up -d --no-deps apm-service
```

### 12.2 Update All Services

```bash
git pull
./deploy/build.sh
docker compose --env-file .env up -d
```

### 12.3 Tagged Releases

```bash
# Build with a version tag
IMAGE_TAG=v1.0.0 ./deploy/build.sh

# Deploy with that tag
IMAGE_TAG=v1.0.0 docker compose --env-file .env up -d
```

### 12.4 Rollback

```bash
# Rollback to previous image tag
IMAGE_TAG=v0.9.0 docker compose --env-file .env up -d
```

---

## 13. Backup & Restore

### 13.1 PostgreSQL Backup

```bash
# Backup
docker exec obs-postgres pg_dump -U myuser mydatabase | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore
gunzip -c backup_20260321_120000.sql.gz | docker exec -i obs-postgres psql -U myuser mydatabase
```

### 13.2 Elasticsearch Backup

```bash
# Create snapshot repository (one-time setup)
curl -X PUT "localhost:9200/_snapshot/backups" -H 'Content-Type: application/json' -d '{
  "type": "fs",
  "settings": { "location": "/usr/share/elasticsearch/data/backups" }
}'

# Create snapshot
curl -X PUT "localhost:9200/_snapshot/backups/snapshot_$(date +%Y%m%d)"

# Restore snapshot
curl -X POST "localhost:9200/_snapshot/backups/snapshot_20260321/_restore"
```

### 13.3 Automated Backup (Cron)

```bash
# Add to crontab: daily at 2 AM
crontab -e

# Add this line:
0 2 * * * docker exec obs-postgres pg_dump -U myuser mydatabase | gzip > /opt/observability/backups/pg_$(date +\%Y\%m\%d).sql.gz && find /opt/observability/backups -name "pg_*.sql.gz" -mtime +7 -delete
```

---

## 14. Production Hardening

### 14.1 Security Checklist

- [ ] Change default `DB_PASSWORD` in `.env`
- [ ] Generate strong `JWT_SECRET`: `openssl rand -base64 64`
- [ ] Set `REDIS_PASSWORD` in `.env` and Redis config
- [ ] Enable TLS (see 14.2)
- [ ] Disable Swagger in production: set `SPRINGDOC_API_DOCS_ENABLED=false`
- [ ] Restrict port exposure (only 80/443 should be public)
- [ ] Set file permissions: `chmod 600 .env`

### 14.2 TLS with Let's Encrypt

Install Certbot and get certificates, then mount them into the frontend container:

```bash
# Install Certbot
sudo apt install -y certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Add to docker-compose.yml frontend service:
#   volumes:
#     - /etc/letsencrypt/live/your-domain.com:/etc/nginx/certs:ro
#
# Update frontend/nginx.conf to listen on 443 with SSL
```

### 14.3 JVM Tuning

Adjust `JAVA_OPTS` in `docker-compose.yml` per service:

| Service | Recommended JAVA_OPTS |
|---------|----------------------|
| user-management-service | `-Xms512m -Xmx1g` |
| apm-service | `-Xms1g -Xmx2g` |
| apm-report-service | `-Xms512m -Xmx1g` |
| apm-ai-service | `-Xms512m -Xmx1g` |

### 14.4 Resource Limits

Add resource limits in `docker-compose.yml`:

```yaml
services:
  apm-service:
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 3G
        reservations:
          cpus: "1.0"
          memory: 1G
```

---

## 15. Troubleshooting

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Elasticsearch won't start | `vm.max_map_count` too low | `sudo sysctl -w vm.max_map_count=262144` |
| Flyway migration conflict | Services started simultaneously | Docker Compose `depends_on` with health checks handles this |
| `NoClassDefFoundError` on shared classes | Shared library not built | Dockerfile builds shared first automatically |
| Frontend can't reach backend | Docker network DNS | Services use Docker Compose service names (e.g., `apm-service:8082`) |
| Port already in use | Another process on the port | `sudo ss -tlnp \| grep :<port>` to find it |
| Container OOM killed | Insufficient memory | Increase `JAVA_OPTS -Xmx` or container memory limit |
| Frontend returns 502 Bad Gateway | Backend not ready yet | Wait for health check to pass; check `docker logs obs-<service>` |
| Python sidecar connection refused | gRPC not ready | Check `docker logs obs-python-sidecar` |
| Images not accessible via public IP | Firewall or port not exposed | Ensure cloud firewall allows TCP 80 |

### Useful Debug Commands

```bash
# Check all container states
docker compose ps

# Check a container's logs
docker compose logs --tail=50 obs-apm

# Inspect a container's network
docker inspect obs-apm | grep -A 20 "NetworkSettings"

# Check Docker network
docker network inspect observability_obs-network

# Check disk usage
docker system df

# Clean up unused images
docker image prune -f

# Restart a stuck container
docker compose restart obs-apm

# Full teardown and fresh start
docker compose down -v
./deploy/build.sh
./deploy/deploy.sh up
```

### Log Locations

| Source | How to Access |
|--------|--------------|
| Backend service logs | `docker compose logs obs-<service>` |
| Nginx access/error | `docker compose logs obs-frontend` |
| PostgreSQL logs | `docker compose logs obs-postgres` |
| Elasticsearch logs | `docker compose logs obs-elasticsearch` |
| Structured logs (JSON) | Elasticsearch index `logs-*` via Jaeger/Kibana |

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Full stack definition (infra + backend + frontend) |
| `.env.example` | Environment variable template |
| `.env` | Your actual environment values (git-ignored) |
| `backend/Dockerfile` | Multi-stage build for all Java services |
| `frontend/Dockerfile` | Multi-stage build for React SPA |
| `frontend/nginx.conf` | Nginx config with API proxy and SPA fallback |
| `backend/apm-ai-service/python-sidecar/Dockerfile` | Python ML sidecar |
| `deploy/build.sh` | Build script for all Docker images |
| `deploy/deploy.sh` | Deployment and lifecycle management script |
| `deploy/prometheus.yml` | Prometheus scrape targets |
| `deploy/otel-collector-config.yml` | OTel Collector pipeline config |
