# Backend Deployment Plan — Ubuntu Cloud Instance

> **Version:** 1.0
> **Date:** 2026-03-21
> **Target Environment:** Single Ubuntu VM (Dev/Staging)
> **Production Target:** GKE (future sprints)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Instance Provisioning](#2-instance-provisioning)
3. [Phase 1 — System Prerequisites](#3-phase-1--system-prerequisites)
4. [Phase 2 — Infrastructure Services (Docker Compose)](#4-phase-2--infrastructure-services-docker-compose)
5. [Phase 3 — Database Initialization](#5-phase-3--database-initialization)
6. [Phase 4 — Build & Deploy Backend Services](#6-phase-4--build--deploy-backend-services)
7. [Phase 5 — Prometheus Scrape Configuration](#7-phase-5--prometheus-scrape-configuration)
8. [Phase 6 — Nginx Reverse Proxy](#8-phase-6--nginx-reverse-proxy)
9. [Phase 7 — Health Verification](#9-phase-7--health-verification)
10. [Phase 8 — Production Hardening](#10-phase-8--production-hardening)
11. [Resource Estimates](#11-resource-estimates)
12. [Environment Variables Reference](#12-environment-variables-reference)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture Overview

```
Ubuntu VM (22.04/24.04 LTS)
│
├── Infrastructure (Docker Compose)
│   ├── PostgreSQL 15          (port 5432)
│   ├── Redis 7                (port 6379)
│   ├── Elasticsearch 8.x      (port 9200)
│   ├── Prometheus             (port 9090)
│   ├── Jaeger (all-in-one)    (port 16686, 4317, 4318)
│   ├── OTel Collector         (port 4317/gRPC, 4318/HTTP)
│   └── MailHog (dev SMTP)     (port 1025, UI 8025)
│
├── Backend Services (systemd / fat JARs)
│   ├── user-management-service (port 8081)
│   ├── apm-service            (port 8082)
│   ├── apm-report-service     (port 8084)
│   ├── apm-ai-service         (port 8085)
│   └── python-sidecar (gRPC)  (port 50051)
│
└── Nginx reverse proxy        (port 80/443)
```

### Port Map

| Port  | Service                    | Protocol |
|-------|----------------------------|----------|
| 80    | Nginx (HTTP)               | TCP      |
| 443   | Nginx (HTTPS)              | TCP      |
| 4317  | OTel Collector / Jaeger    | gRPC     |
| 4318  | OTel Collector             | HTTP     |
| 5432  | PostgreSQL                 | TCP      |
| 6379  | Redis                      | TCP      |
| 8025  | MailHog UI                 | HTTP     |
| 8081  | user-management-service    | HTTP     |
| 8082  | apm-service                | HTTP     |
| 8084  | apm-report-service         | HTTP     |
| 8085  | apm-ai-service             | HTTP     |
| 9090  | Prometheus                 | HTTP     |
| 9200  | Elasticsearch              | HTTP     |
| 16686 | Jaeger UI                  | HTTP     |
| 50051 | Python ML Sidecar          | gRPC     |

---

## 2. Instance Provisioning

### Minimum Specification

| Resource | Minimum     | Recommended |
|----------|-------------|-------------|
| OS       | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| vCPU     | 8 cores     | 16 cores    |
| RAM      | 16 GB       | 32 GB       |
| Disk     | 100 GB SSD  | 200 GB SSD  |

### Cloud Provider Options

- **GCP:** `e2-standard-8` (8 vCPU / 32 GB) or `n2-standard-8`
- **AWS:** `m5.2xlarge` (8 vCPU / 32 GB)
- **Azure:** `Standard_D8s_v5` (8 vCPU / 32 GB)

### Firewall / Security Group Rules

| Rule      | Port       | Source      | Purpose             |
|-----------|------------|-------------|---------------------|
| SSH       | 22         | Your IP     | Remote access       |
| HTTP      | 80         | 0.0.0.0/0   | Web traffic         |
| HTTPS     | 443        | 0.0.0.0/0   | Secure web traffic  |
| Prometheus| 9090       | VPN / Team  | Metrics dashboard   |
| Jaeger    | 16686      | VPN / Team  | Trace UI            |
| MailHog   | 8025       | VPN / Team  | Dev email testing   |

> **Important:** Ports 5432, 6379, 9200, 8081-8085, 50051 should NOT be exposed externally. Keep them on `127.0.0.1` or internal network only.

---

## 3. Phase 1 — System Prerequisites

### 3.1 System Update

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### 3.2 Create Application User

```bash
sudo useradd -r -m -s /bin/bash observability
sudo mkdir -p /opt/observability
sudo chown observability:observability /opt/observability
```

### 3.3 Install Docker & Docker Compose

```bash
# Add Docker's official GPG key and repository
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow observability user to run Docker
sudo usermod -aG docker observability
```

### 3.4 Install Java 25 (JDK)

```bash
# Option A: SDKMAN (recommended)
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh
sdk install java 25-open

# Option B: Manual (if SDKMAN not available)
# Download from https://jdk.java.net/25/ and extract to /usr/lib/jvm/
```

Verify:

```bash
java -version
# Expected: openjdk version "25" ...
```

### 3.5 Install Python 3.12

```bash
sudo apt install -y python3.12 python3.12-venv python3.12-dev python3-pip
```

### 3.6 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 3.7 Clone Repository

```bash
sudo -u observability git clone <REPO_URL> /opt/observability/platform
```

---

## 4. Phase 2 — Infrastructure Services (Docker Compose)

### 4.1 Create Docker Compose File

Create `/opt/observability/deploy/docker-compose.infra.yml`:

```yaml
version: "3.9"

services:

  # ─── PostgreSQL ──────────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    container_name: obs-postgres
    restart: unless-stopped
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydatabase
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myuser -d mydatabase"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Redis ───────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: obs-redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Elasticsearch ───────────────────────────────────────────
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.15.0
    container_name: obs-elasticsearch
    restart: unless-stopped
    ports:
      - "127.0.0.1:9200:9200"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - xpack.security.enrollment.enabled=false
      - ES_JAVA_OPTS=-Xms2g -Xmx2g
      - cluster.name=observability
    volumes:
      - esdata:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 10

  # ─── Prometheus ──────────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    container_name: obs-prometheus
    restart: unless-stopped
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - promdata:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--web.enable-remote-write-receiver"
      - "--storage.tsdb.retention.time=30d"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:9090/-/healthy || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Jaeger (All-in-One with ES backend) ─────────────────────
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: obs-jaeger
    restart: unless-stopped
    ports:
      - "127.0.0.1:16686:16686"   # Jaeger UI
      - "127.0.0.1:4317:4317"     # OTLP gRPC
      - "127.0.0.1:4318:4318"     # OTLP HTTP
    environment:
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200
    depends_on:
      elasticsearch:
        condition: service_healthy

  # ─── OpenTelemetry Collector ─────────────────────────────────
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    container_name: obs-otel-collector
    restart: unless-stopped
    ports:
      - "127.0.0.1:4327:4317"     # OTLP gRPC (remapped to avoid Jaeger conflict)
      - "127.0.0.1:4328:4318"     # OTLP HTTP (remapped)
    volumes:
      - ./otel-collector-config.yml:/etc/otelcol-contrib/config.yaml
    depends_on:
      - jaeger
      - prometheus
      - elasticsearch

  # ─── MailHog (Dev SMTP) ──────────────────────────────────────
  mailhog:
    image: mailhog/mailhog:latest
    container_name: obs-mailhog
    restart: unless-stopped
    ports:
      - "127.0.0.1:1025:1025"     # SMTP
      - "127.0.0.1:8025:8025"     # Web UI

volumes:
  pgdata:
  redisdata:
  esdata:
  promdata:
```

### 4.2 Create Database Init Script

Create `/opt/observability/deploy/init-db.sql`:

```sql
-- Flyway handles schema creation, but we need the database(s) to exist.
-- If using separate databases per service, uncomment below:

-- CREATE DATABASE user_mgmt_db;
-- CREATE DATABASE apm_db;
-- CREATE DATABASE report_db;
-- CREATE DATABASE ai_db;

-- Grant privileges
-- GRANT ALL PRIVILEGES ON DATABASE user_mgmt_db TO myuser;
-- GRANT ALL PRIVILEGES ON DATABASE apm_db TO myuser;
-- GRANT ALL PRIVILEGES ON DATABASE report_db TO myuser;
-- GRANT ALL PRIVILEGES ON DATABASE ai_db TO myuser;

-- Current setup: all services share "mydatabase" (default POSTGRES_DB)
```

### 4.3 Start Infrastructure

```bash
cd /opt/observability/deploy
docker compose -f docker-compose.infra.yml up -d

# Verify all containers are healthy
docker compose -f docker-compose.infra.yml ps
```

### 4.4 Expected Container States

| Container           | Status   | Health     |
|---------------------|----------|------------|
| obs-postgres        | Running  | healthy    |
| obs-redis           | Running  | healthy    |
| obs-elasticsearch   | Running  | healthy    |
| obs-prometheus      | Running  | healthy    |
| obs-jaeger          | Running  | running    |
| obs-otel-collector  | Running  | running    |
| obs-mailhog         | Running  | running    |

---

## 5. Phase 3 — Database Initialization

Flyway handles all schema migrations automatically on service startup. The migration files are located in each service's `src/main/resources/db/migration/` directory.

### Migration Inventory

| Service                  | Versions   | Key Tables Created                                          |
|--------------------------|------------|-------------------------------------------------------------|
| user-management-service  | V1 — V3    | USERS, ROLES, PERMISSIONS, ROLE_PERMISSIONS, USER_ROLES     |
| apm-service              | V4 — V12   | SERVICES, SLA_RULES, ALERT_CHANNELS, DEPENDENCIES, WORKFLOWS, DASHBOARDS |
| apm-report-service       | V13 — V14  | REPORTS, SYNTHETIC_CHECKS                                   |
| apm-ai-service           | V15        | AI-related tables                                           |

### Startup Order Matters

Services must start in this order to avoid Flyway version conflicts (all share one database):

```
1. user-management-service  (V1-V3)
2. apm-service              (V4-V12)
3. apm-report-service       (V13-V14)
4. apm-ai-service           (V15)
```

### Manual Verification (Optional)

```bash
# Connect to PostgreSQL
docker exec -it obs-postgres psql -U myuser -d mydatabase

# Check Flyway history
SELECT * FROM flyway_schema_history ORDER BY installed_rank;

# Check table list
\dt
```

---

## 6. Phase 4 — Build & Deploy Backend Services

### 6.1 Build All Services

```bash
cd /opt/observability/platform/backend

# Build shared library first, then all services
./mvnw clean install -DskipTests
```

This produces fat JARs:

| Service                  | JAR Location                                                          |
|--------------------------|-----------------------------------------------------------------------|
| user-management-service  | `user-management-service/target/user-management-service-0.0.1-SNAPSHOT.jar`  |
| apm-service              | `apm-service/target/apm-service-0.0.1-SNAPSHOT.jar`                          |
| apm-report-service       | `apm-report-service/target/apm-report-service-0.0.1-SNAPSHOT.jar`            |
| apm-ai-service           | `apm-ai-service/target/apm-ai-service-0.0.1-SNAPSHOT.jar`                    |

### 6.2 Deploy Python ML Sidecar

#### Option A: Docker (Recommended)

```bash
cd /opt/observability/platform/backend/apm-ai-service/python-sidecar

docker build -t obs-python-sidecar .

docker run -d \
  --name obs-python-sidecar \
  --restart unless-stopped \
  -p 127.0.0.1:50051:50051 \
  -e LLM_PROVIDER=openai \
  -e OPENAI_API_KEY=sk-your-key-here \
  -e OPENAI_MODEL=gpt-4o \
  obs-python-sidecar
```

#### Option B: Native (systemd)

```bash
cd /opt/observability/platform/backend/apm-ai-service/python-sidecar
python3.12 -m venv /opt/observability/sidecar-venv
source /opt/observability/sidecar-venv/bin/activate
pip install -r requirements.txt
python generate_protos.py
```

Create `/etc/systemd/system/obs-python-sidecar.service`:

```ini
[Unit]
Description=Observability Python ML Sidecar
After=network.target

[Service]
User=observability
WorkingDirectory=/opt/observability/platform/backend/apm-ai-service/python-sidecar
ExecStart=/opt/observability/sidecar-venv/bin/python server.py --port 50051
EnvironmentFile=/etc/observability/sidecar.env
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 6.3 Create Environment File

Create `/etc/observability/backend.env`:

```bash
# ─── Database ─────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=myuser
DB_PASSWORD=mypassword
DB_NAME=mydatabase
APM_DB_NAME=mydatabase
REPORT_DB_NAME=mydatabase

# ─── Redis ────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ─── Elasticsearch ────────────────────────────────────────────
ELASTICSEARCH_URI=http://localhost:9200
ELASTICSEARCH_URL=http://localhost:9200
ES_LOG_INDEX=logs-*
ES_ALERT_INDEX=alerts-*

# ─── Prometheus ───────────────────────────────────────────────
PROMETHEUS_URL=http://localhost:9090

# ─── Jaeger ───────────────────────────────────────────────────
JAEGER_QUERY_URL=http://localhost:16686

# ─── JWT (shared across all services) ─────────────────────────
JWT_SECRET=bXktc3VwZXItc2VjcmV0LWtleS1mb3Itand0LXRva2VuLXNpZ25pbmctdGhhdC1pcy1sb25nLWVub3VnaC1mb3ItaG1hYy1zaGE1MTI=

# ─── SMTP (MailHog for dev) ───────────────────────────────────
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_AUTH=false
SMTP_STARTTLS=false

# ─── AI/ML Sidecar ───────────────────────────────────────────
ML_SIDECAR_HOST=localhost
ML_SIDECAR_PORT=50051
ML_SIDECAR_TIMEOUT=30000

# ─── Report Service ──────────────────────────────────────────
REPORT_STORAGE_DIR=/opt/observability/reports
REPORT_RETENTION_DAYS=30
REPORT_EMAIL_FROM=reports@observability-platform.local
REPORT_EMAIL_SUBJECT_PREFIX=[Observability Platform]
```

Secure the file:

```bash
sudo mkdir -p /etc/observability
sudo chmod 600 /etc/observability/backend.env
sudo chown observability:observability /etc/observability/backend.env
```

### 6.4 Create systemd Service Units

#### user-management-service

Create `/etc/systemd/system/obs-user-management.service`:

```ini
[Unit]
Description=Observability - User Management Service
After=network.target docker.service
Requires=docker.service

[Service]
User=observability
WorkingDirectory=/opt/observability/platform/backend/user-management-service
ExecStart=/usr/bin/java \
  -Xms512m -Xmx1g \
  -Dspring.profiles.active=prod \
  -Dserver.port=8081 \
  -jar target/user-management-service-0.0.1-SNAPSHOT.jar
EnvironmentFile=/etc/observability/backend.env
Restart=on-failure
RestartSec=15
StartLimitBurst=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=obs-user-mgmt

[Install]
WantedBy=multi-user.target
```

#### apm-service

Create `/etc/systemd/system/obs-apm.service`:

```ini
[Unit]
Description=Observability - APM Service
After=network.target obs-user-management.service
Wants=obs-user-management.service

[Service]
User=observability
WorkingDirectory=/opt/observability/platform/backend/apm-service
ExecStart=/usr/bin/java \
  -Xms1g -Xmx2g \
  -Dspring.profiles.active=prod \
  -Dserver.port=8082 \
  -jar target/apm-service-0.0.1-SNAPSHOT.jar
EnvironmentFile=/etc/observability/backend.env
Restart=on-failure
RestartSec=15
StartLimitBurst=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=obs-apm

[Install]
WantedBy=multi-user.target
```

#### apm-report-service

Create `/etc/systemd/system/obs-apm-report.service`:

```ini
[Unit]
Description=Observability - APM Report Service
After=network.target obs-apm.service
Wants=obs-apm.service

[Service]
User=observability
WorkingDirectory=/opt/observability/platform/backend/apm-report-service
ExecStart=/usr/bin/java \
  -Xms512m -Xmx1g \
  -Dspring.profiles.active=prod \
  -Dserver.port=8084 \
  -jar target/apm-report-service-0.0.1-SNAPSHOT.jar
EnvironmentFile=/etc/observability/backend.env
Restart=on-failure
RestartSec=15
StartLimitBurst=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=obs-apm-report

[Install]
WantedBy=multi-user.target
```

#### apm-ai-service

Create `/etc/systemd/system/obs-apm-ai.service`:

```ini
[Unit]
Description=Observability - APM AI Service
After=network.target obs-apm.service
Wants=obs-apm.service

[Service]
User=observability
WorkingDirectory=/opt/observability/platform/backend/apm-ai-service
ExecStart=/usr/bin/java \
  -Xms512m -Xmx1g \
  -Dspring.profiles.active=prod \
  -Dserver.port=8085 \
  -jar target/apm-ai-service-0.0.1-SNAPSHOT.jar
EnvironmentFile=/etc/observability/backend.env
Restart=on-failure
RestartSec=15
StartLimitBurst=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=obs-apm-ai

[Install]
WantedBy=multi-user.target
```

### 6.5 Enable & Start Services

```bash
sudo systemctl daemon-reload

# Enable all services to start on boot
sudo systemctl enable obs-user-management obs-apm obs-apm-report obs-apm-ai

# Start in order (wait for each to become healthy before starting next)
sudo systemctl start obs-user-management
sleep 30  # Wait for Flyway V1-V3 migrations

sudo systemctl start obs-apm
sleep 30  # Wait for Flyway V4-V12 migrations

sudo systemctl start obs-apm-report
sleep 15  # Wait for Flyway V13-V14 migrations

sudo systemctl start obs-apm-ai
```

### 6.6 Verify Service Status

```bash
sudo systemctl status obs-user-management obs-apm obs-apm-report obs-apm-ai

# View logs
journalctl -u obs-user-management -f
journalctl -u obs-apm -f
journalctl -u obs-apm-report -f
journalctl -u obs-apm-ai -f
```

---

## 7. Phase 5 — Prometheus Scrape Configuration

Create `/opt/observability/deploy/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "user-management-service"
    metrics_path: "/actuator/prometheus"
    static_configs:
      - targets: ["host.docker.internal:8081"]
        labels:
          service: "user-management"

  - job_name: "apm-service"
    metrics_path: "/actuator/prometheus"
    static_configs:
      - targets: ["host.docker.internal:8082"]
        labels:
          service: "apm"

  - job_name: "apm-report-service"
    metrics_path: "/actuator/prometheus"
    static_configs:
      - targets: ["host.docker.internal:8084"]
        labels:
          service: "apm-report"

  - job_name: "apm-ai-service"
    metrics_path: "/actuator/prometheus"
    static_configs:
      - targets: ["host.docker.internal:8085"]
        labels:
          service: "apm-ai"

  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]
```

> **Note:** Since Prometheus runs inside Docker and services run on the host, use `host.docker.internal` (or the Docker bridge IP `172.17.0.1` on Linux) to reach host-bound services.

After creating the file, restart Prometheus:

```bash
docker compose -f docker-compose.infra.yml restart prometheus
```

---

## 8. Phase 6 — Nginx Reverse Proxy

### 8.1 Create Nginx Configuration

Create `/etc/nginx/sites-available/observability`:

```nginx
# ─── Upstreams ─────────────────────────────────────────────────
upstream user_mgmt   { server 127.0.0.1:8081; }
upstream apm         { server 127.0.0.1:8082; }
upstream apm_report  { server 127.0.0.1:8084; }
upstream apm_ai      { server 127.0.0.1:8085; }

server {
    listen 80;
    server_name _;  # Replace with your domain

    # ─── Proxy defaults ───────────────────────────────────────
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 10s;
    proxy_read_timeout    60s;
    proxy_send_timeout    60s;

    # ─── User Management Service ──────────────────────────────
    location /api/v1/auth/      { proxy_pass http://user_mgmt; }
    location /api/v1/users/     { proxy_pass http://user_mgmt; }
    location /api/v1/roles/     { proxy_pass http://user_mgmt; }
    location /api/v1/permissions/ { proxy_pass http://user_mgmt; }

    # ─── APM Service ──────────────────────────────────────────
    location /api/v1/services/      { proxy_pass http://apm; }
    location /api/v1/metrics/       { proxy_pass http://apm; }
    location /api/v1/logs/          { proxy_pass http://apm; }
    location /api/v1/traces/        { proxy_pass http://apm; }
    location /api/v1/sla/           { proxy_pass http://apm; }
    location /api/v1/alerts/        { proxy_pass http://apm; }
    location /api/v1/dashboards/    { proxy_pass http://apm; }
    location /api/v1/workflows/     { proxy_pass http://apm; }
    location /api/v1/dependencies/  { proxy_pass http://apm; }

    # ─── Report Service ───────────────────────────────────────
    location /api/v1/reports/   { proxy_pass http://apm_report; }
    location /api/v1/synthetic/ { proxy_pass http://apm_report; }

    # ─── AI Service ───────────────────────────────────────────
    location /api/v1/ai/        { proxy_pass http://apm_ai; }

    # ─── Swagger UI per service ────────────────────────────────
    location /user-mgmt/ {
        proxy_pass http://user_mgmt/;
    }
    location /apm/ {
        proxy_pass http://apm/;
    }
    location /apm-report/ {
        proxy_pass http://apm_report/;
    }
    location /apm-ai/ {
        proxy_pass http://apm_ai/;
    }

    # ─── Prometheus UI (internal access) ──────────────────────
    location /prometheus/ {
        proxy_pass http://127.0.0.1:9090/;
    }

    # ─── Jaeger UI (internal access) ──────────────────────────
    location /jaeger/ {
        proxy_pass http://127.0.0.1:16686/;
    }

    # ─── MailHog UI (dev only) ────────────────────────────────
    location /mailhog/ {
        proxy_pass http://127.0.0.1:8025/;
    }

    # ─── Health check endpoint ────────────────────────────────
    location /health {
        return 200 '{"status":"UP"}';
        add_header Content-Type application/json;
    }
}
```

### 8.2 Enable & Reload Nginx

```bash
sudo ln -s /etc/nginx/sites-available/observability /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 8.3 TLS with Let's Encrypt (Production)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 9. Phase 7 — Health Verification

Run these checks after deployment to verify all components are operational.

### 9.1 Infrastructure Health

```bash
# PostgreSQL
docker exec obs-postgres pg_isready -U myuser -d mydatabase

# Redis
docker exec obs-redis redis-cli ping

# Elasticsearch
curl -s http://localhost:9200/_cluster/health | python3 -m json.tool

# Prometheus
curl -s http://localhost:9090/-/healthy

# Jaeger UI
curl -s -o /dev/null -w "%{http_code}" http://localhost:16686

# MailHog
curl -s -o /dev/null -w "%{http_code}" http://localhost:8025
```

### 9.2 Backend Service Health

```bash
# User Management Service
curl -s http://localhost:8081/actuator/health | python3 -m json.tool

# APM Service
curl -s http://localhost:8082/actuator/health | python3 -m json.tool

# Report Service
curl -s http://localhost:8084/actuator/health | python3 -m json.tool

# AI Service
curl -s http://localhost:8085/actuator/health | python3 -m json.tool
```

### 9.3 Prometheus Targets

```bash
# Check all scrape targets are UP
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool
```

### 9.4 End-to-End API Test

```bash
# Login (get JWT token)
TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Test authenticated endpoint
curl -s http://localhost/api/v1/services \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### 9.5 Quick Health Check Script

Create `/opt/observability/deploy/healthcheck.sh`:

```bash
#!/bin/bash
set -e

echo "=== Infrastructure ==="
echo -n "PostgreSQL: "; docker exec obs-postgres pg_isready -U myuser -d mydatabase > /dev/null 2>&1 && echo "OK" || echo "FAIL"
echo -n "Redis:      "; docker exec obs-redis redis-cli ping 2>/dev/null | tr -d '\n'; echo ""
echo -n "Elastic:    "; curl -sf http://localhost:9200/_cluster/health | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "FAIL"
echo -n "Prometheus: "; curl -sf http://localhost:9090/-/healthy > /dev/null && echo "OK" || echo "FAIL"
echo -n "Jaeger:     "; curl -sf -o /dev/null http://localhost:16686 && echo "OK" || echo "FAIL"

echo ""
echo "=== Backend Services ==="
for svc in 8081 8082 8084 8085; do
  echo -n "Port $svc:    "
  STATUS=$(curl -sf http://localhost:$svc/actuator/health 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
  echo "${STATUS:-FAIL}"
done
```

```bash
chmod +x /opt/observability/deploy/healthcheck.sh
```

---

## 10. Phase 8 — Production Hardening

### 10.1 Security

| Action | Command / Config |
|--------|-----------------|
| Firewall (UFW) | `sudo ufw allow 22,80,443/tcp && sudo ufw enable` |
| Secure env files | `chmod 600 /etc/observability/*.env` |
| Change default JWT secret | Generate new: `openssl rand -base64 64` |
| Change DB passwords | Update PostgreSQL + env files |
| Disable Swagger in prod | Set `springdoc.api-docs.enabled=false` |
| Rate limiting (Nginx) | Add `limit_req_zone` directives |

### 10.2 Backups

```bash
# PostgreSQL daily backup (add to crontab)
0 2 * * * docker exec obs-postgres pg_dump -U myuser mydatabase | gzip > /opt/observability/backups/pg_$(date +\%Y\%m\%d).sql.gz

# Elasticsearch snapshot (configure repository first)
curl -X PUT "localhost:9200/_snapshot/backup" -H 'Content-Type: application/json' -d '{
  "type": "fs",
  "settings": { "location": "/usr/share/elasticsearch/data/backups" }
}'
```

### 10.3 Log Management

```bash
# journald log retention
sudo journalctl --vacuum-time=30d
sudo journalctl --vacuum-size=2G

# Add to /etc/systemd/journald.conf:
# SystemMaxUse=2G
# MaxRetentionSec=30day
```

### 10.4 JVM Tuning Recommendations

| Service                  | Heap (Xms/Xmx) | Notes                              |
|--------------------------|-----------------|-------------------------------------|
| user-management-service  | 512m / 1g       | Low traffic, auth-only              |
| apm-service              | 1g / 2g         | Heaviest — queries Prometheus/ES    |
| apm-report-service       | 512m / 1g       | PDF generation spikes               |
| apm-ai-service           | 512m / 1g       | Most work done by Python sidecar    |

### 10.5 Monitoring the Monitor

Add Prometheus alerting rules for self-monitoring:

```yaml
# /opt/observability/deploy/alert-rules.yml
groups:
  - name: service-health
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"

      - alert: HighMemoryUsage
        expr: jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"} > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.job }} heap usage > 90%"

      - alert: HighCPU
        expr: system_cpu_usage > 0.85
        for: 5m
        labels:
          severity: warning
```

---

## 11. Resource Estimates

### Per-Component Breakdown

| Component              | RAM       | CPU       | Disk    |
|------------------------|-----------|-----------|---------|
| PostgreSQL             | 2 GB      | 1 core    | 20 GB   |
| Elasticsearch          | 4 GB      | 2 cores   | 50 GB   |
| Redis                  | 512 MB    | 0.5 core  | 1 GB    |
| Prometheus             | 1 GB      | 0.5 core  | 20 GB   |
| Jaeger                 | 512 MB    | 0.5 core  | — (ES)  |
| OTel Collector         | 256 MB    | 0.25 core | —       |
| MailHog                | 64 MB     | 0.1 core  | —       |
| user-management (JVM)  | 1 GB      | 0.5 core  | 200 MB  |
| apm-service (JVM)      | 2 GB      | 1 core    | 200 MB  |
| apm-report (JVM)       | 1 GB      | 0.5 core  | 500 MB  |
| apm-ai (JVM)           | 1 GB      | 0.5 core  | 200 MB  |
| python-sidecar         | 512 MB    | 0.5 core  | 500 MB  |
| Nginx + OS             | 1 GB      | 0.5 core  | 5 GB    |
| **TOTAL**              | **~16 GB**| **~8 cores**| **~100 GB** |

### Instance Sizing Guide

| Load Level     | vCPU  | RAM    | Disk    | GCP Instance       |
|----------------|-------|--------|---------|---------------------|
| Dev / Testing  | 8     | 16 GB  | 100 GB  | e2-standard-4       |
| Staging        | 8     | 32 GB  | 200 GB  | e2-standard-8       |
| Light Prod     | 16    | 64 GB  | 500 GB  | n2-standard-16      |

---

## 12. Environment Variables Reference

### Complete Variable List

| Variable | Used By | Default | Description |
|----------|---------|---------|-------------|
| `DB_HOST` | All | `localhost` | PostgreSQL host |
| `DB_PORT` | All | `5432` | PostgreSQL port |
| `DB_USERNAME` | All | `myuser` | PostgreSQL username |
| `DB_PASSWORD` | All | `mypassword` | PostgreSQL password |
| `DB_NAME` | user-mgmt | `mydatabase` | Database name |
| `APM_DB_NAME` | apm | `mydatabase` | Database name |
| `REPORT_DB_NAME` | report | `mydatabase` | Database name |
| `REDIS_HOST` | apm, report | `localhost` | Redis host |
| `REDIS_PORT` | apm, report | `6379` | Redis port |
| `REDIS_PASSWORD` | apm, report | _(empty)_ | Redis password |
| `ELASTICSEARCH_URI` | user-mgmt | `http://localhost:9200` | ES connection |
| `ELASTICSEARCH_URL` | apm, report | `http://localhost:9200` | ES connection |
| `PROMETHEUS_URL` | apm, report | `http://localhost:9090` | Prometheus URL |
| `JAEGER_QUERY_URL` | apm | `http://localhost:16686` | Jaeger Query URL |
| `JWT_SECRET` | All | _(base64 string)_ | Shared JWT signing key |
| `SMTP_HOST` | apm, report | `localhost` | SMTP server host |
| `SMTP_PORT` | apm, report | `1025` | SMTP server port |
| `ML_SIDECAR_HOST` | ai | `localhost` | Python sidecar host |
| `ML_SIDECAR_PORT` | ai | `50051` | Python sidecar port |
| `LLM_PROVIDER` | ai, sidecar | `openai` | LLM provider |
| `OPENAI_API_KEY` | ai, sidecar | _(required)_ | OpenAI API key |
| `REPORT_STORAGE_DIR` | report | `/tmp/reports` | Report file storage |
| `REPORT_RETENTION_DAYS` | report | `30` | Report cleanup age |

---

## 13. Troubleshooting

### Common Issues

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| Elasticsearch won't start | `vm.max_map_count` too low | `sudo sysctl -w vm.max_map_count=262144` and add to `/etc/sysctl.conf` |
| Flyway migration conflict | Two services started simultaneously | Start services sequentially (see Phase 3) |
| Service can't reach PostgreSQL | Docker binding on 127.0.0.1 | Check `docker ps` port mapping, ensure host networking or correct bind |
| OOM on JVM service | Heap too small for workload | Increase `-Xmx` in systemd unit |
| Prometheus targets DOWN | Firewall or wrong target address | Use `host.docker.internal` or `172.17.0.1` for Docker→host access |
| Redis connection refused | Redis not started or wrong port | `docker logs obs-redis`, check port binding |
| Python sidecar timeout | gRPC deadline exceeded | Increase `ML_SIDECAR_TIMEOUT`, check sidecar logs |

### Useful Commands

```bash
# View all service logs
journalctl -u 'obs-*' -f

# Restart a single service
sudo systemctl restart obs-apm

# Check Docker container resource usage
docker stats --no-stream

# Check disk usage
df -h /opt/observability

# Check open ports
sudo ss -tlnp

# Full system restart (infra + services)
cd /opt/observability/deploy && docker compose -f docker-compose.infra.yml restart
sudo systemctl restart obs-user-management obs-apm obs-apm-report obs-apm-ai
```

---

> **Next Steps:** Once this single-instance deployment is validated, the production path is to containerize all Java services (Dockerfiles), create Helm charts, and deploy to GKE as outlined in the HLD (Phase 5, Sprints 18-20).
