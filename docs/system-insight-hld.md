# System Insight — High-Level Design (HLD)

> **Version:** 2.0
> **Date:** 2026-03-20
> **Platform:** System Insight — Full-Stack Observability Platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Features Overview](#2-features-overview)
3. [Technology Stack](#3-technology-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [End-to-End System Diagram](#5-end-to-end-system-diagram)
6. [Backend Microservices Architecture](#6-backend-microservices-architecture)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Database Design](#8-database-design)
9. [API Design & Conventions](#9-api-design--conventions)
10. [Security Architecture](#10-security-architecture)
11. [Sequence Diagrams](#11-sequence-diagrams)
12. [Observability & Telemetry Pipeline](#12-observability--telemetry-pipeline)
13. [Deployment Topology](#13-deployment-topology)
14. [Module Inventory](#14-module-inventory)

---

## 1. Executive Summary

**System Insight** is an enterprise-grade, full-stack observability platform that provides unified monitoring, alerting, and analytics across distributed services. It correlates the three pillars of observability — **Metrics**, **Logs**, and **Traces** — into a single pane of glass, enabling engineering teams to detect, diagnose, and resolve production issues rapidly.

### Key Highlights

| Dimension | Detail |
|-----------|--------|
| **Architecture** | Spring Boot 3.5.7 microservices (5 modules) + React 18 SPA |
| **Language** | Java 25 (backend), TypeScript 5.5 (frontend) |
| **Observability Signals** | Metrics (Prometheus), Logs (Elasticsearch), Traces (Jaeger) |
| **Instrumentation** | OpenTelemetry (both frontend & backend) with W3C trace propagation |
| **AI/ML** | Anomaly detection, root-cause analysis, forecasting, LLM-powered error diagnosis via gRPC Python sidecar |
| **Auth** | JWT + OAuth2/OIDC (Azure AD) with RBAC |
| **Modules** | 13 functional modules across 5 backend services and 24+ frontend pages |
| **Deployment** | Independent JARs per service, horizontally scalable |

### Business Value

- **Reduce MTTR** — Cross-signal correlation (traces ↔ logs ↔ metrics) pinpoints root causes in seconds
- **Proactive Alerting** — SLA-based rules with multi-channel notifications (Email, SMS, MS Teams)
- **AI-Assisted Diagnosis** — LLM-powered error analysis and anomaly detection reduce manual investigation
- **Custom Dashboards** — Drag-and-drop widgets with template variables for team-specific views
- **Workflow Monitoring** — End-to-end business process tracking across microservices
- **Synthetic Monitoring** — Proactive endpoint health checks before users are impacted

---

## 2. Features Overview

### 2.1 Functional Modules (13)

| # | Module | Description |
|---|--------|-------------|
| 1 | **Authentication & RBAC** | JWT + Azure AD SSO, role-based access (Admin, Operator, Viewer), permission matrix |
| 2 | **Service Catalog** | Service registry (manual + auto-discovery), metadata (team, env, tier), signal toggles |
| 3 | **Metrics Explorer** | 6-tab metrics view — Service, API, Infrastructure, UI (Web Vitals), Query (DB), Log metrics |
| 4 | **Log Explorer** | Full-text log search, severity filtering, trace correlation, enrichment validation, inline AI diagnosis |
| 5 | **Trace Viewer** | Distributed trace search, span waterfall, service breakdown, cross-signal correlation |
| 6 | **APM Overview** | Fleet-wide health dashboard, service health scores, signal distribution |
| 7 | **Alerts & SLA** | Metric/log-based SLA rules, alert state machine (OK→PENDING→FIRING→RESOLVED), acknowledgment, suppression |
| 8 | **Dependencies** | Interactive D3 force-directed graph, dependency extraction from traces, per-dependency metrics |
| 9 | **Workflows** | Business process definitions, step correlation, live instance tracking, Sankey visualizations |
| 10 | **Custom Dashboards** | Drag-and-drop canvas, 6 widget types, template variables, cloning, time-range picker |
| 11 | **Reports** | KPI & performance reports, PDF generation, scheduled email delivery |
| 12 | **Synthetic Monitoring** | HTTP probes, cron scheduling, latency/status validation, result history |
| 13 | **AI/ML Engine** | Anomaly detection, root-cause analysis, time-series forecasting, LLM error diagnosis |

### 2.2 Non-Functional Features

- **Theming** — Light/Dark/System mode, 9 accent colors, 6 font families, 5 section color presets
- **OpenTelemetry** — Full browser instrumentation (fetch, XHR, document load, user interaction, Web Vitals)
- **Global Search** — Quick service lookup across the platform
- **Audit Logging** — User actions indexed to Elasticsearch
- **Rate Limiting** — Token-bucket algorithm on authentication endpoints
- **Caching** — Redis with per-cache TTL (services: 5min, metrics: 1min)

---

## 3. Technology Stack

### 3.1 Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Spring Boot | 3.5.7 |
| **Language** | Java (JDK) | 25 |
| **Build** | Maven | 3.x |
| **ORM** | Hibernate / Spring Data JPA | 6.x |
| **Migrations** | Flyway | Latest |
| **Security** | Spring Security + JWT (JJWT) | 0.12.5 |
| **OAuth2** | Spring OAuth2 Client/Resource Server | — |
| **Cache** | Redis (Spring Data Redis) | — |
| **Mapping** | MapStruct | 1.5.5 |
| **Boilerplate** | Lombok | 1.18.42 |
| **API Docs** | SpringDoc OpenAPI (Swagger) | 2.5.0 |
| **PDF** | OpenHtmlToPdf | 1.0.10 |
| **Templates** | Thymeleaf | — |
| **gRPC** | gRPC Java + Protobuf | 1.68.0 / 4.28.3 |
| **Logging** | Logstash Logback Encoder | 7.4 |
| **Observability** | Micrometer Prometheus + OTel SDK | 1.39.0 |
| **Testing** | JUnit 5, Testcontainers | — |

### 3.2 Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | React | 18.3.1 |
| **Language** | TypeScript | 5.5.3 |
| **Build** | Vite | 5.3.4 |
| **UI Library** | Material-UI (MUI) | 5.16.0 |
| **Styling** | Emotion + Tailwind CSS | 11.13.0 / 3.4.6 |
| **State** | Zustand | 4.5.4 |
| **Routing** | React Router DOM | 6.24.0 |
| **HTTP** | Axios | 1.7.2 |
| **Charts** | Recharts | 3.8.0 |
| **Graphs** | D3.js | 7.9.0 |
| **Dashboards** | React Grid Layout | 2.2.2 |
| **Date/Time** | dayjs + MUI X Date Pickers | 1.11.20 / 8.27.2 |
| **Telemetry** | OpenTelemetry Web SDK | 2.6.0 |
| **Web Vitals** | web-vitals | 5.1.0 |
| **Storybook** | Storybook | 8.2.0 |

### 3.3 Data Stores & Infrastructure

| Component | Purpose |
|-----------|---------|
| **PostgreSQL** | Primary relational database (all services) |
| **Redis** | Caching layer + async task queue |
| **Elasticsearch** | Log storage, aggregations, audit logging |
| **Prometheus** | Metrics collection and PromQL queries |
| **Jaeger** | Distributed trace storage and query |
| **OpenTelemetry Collector** | Telemetry pipeline (receive, process, export) |
| **SMTP** | Email delivery for alerts and reports |

---

## 4. Architecture Overview

### 4.1 High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["Browser (React SPA)"]
        OTelWeb["OTel Web SDK"]
    end

    subgraph "API Gateway / Reverse Proxy"
        Vite["Vite Dev Proxy / Nginx"]
    end

    subgraph "Backend Microservices"
        UMS["User Management Service<br/>:8081"]
        APM["APM Service<br/>:8082"]
        RPT["Report Service<br/>:8084"]
        AI["AI Service<br/>:8085"]
    end

    subgraph "Shared Library"
        SH["observability-shared<br/>(exception handling, logging, MDC)"]
    end

    subgraph "ML Layer"
        PY["Python ML Sidecar<br/>:50051 (gRPC)"]
    end

    subgraph "Data Stores"
        PG["PostgreSQL"]
        RD["Redis"]
        ES["Elasticsearch"]
    end

    subgraph "Observability Backend"
        PROM["Prometheus"]
        JAEG["Jaeger"]
        OTELC["OTel Collector<br/>:4317 / :4318"]
    end

    subgraph "Notifications"
        SMTP["SMTP Server"]
        TEAMS["MS Teams Webhook"]
    end

    Browser -->|"REST /api/v1/*"| Vite
    OTelWeb -->|"OTLP/HTTP :4318"| OTELC
    Vite --> UMS
    Vite --> APM
    Vite --> RPT
    Vite --> AI

    SH -.->|auto-config| UMS
    SH -.->|auto-config| APM
    SH -.->|auto-config| RPT
    SH -.->|auto-config| AI

    UMS --> PG
    UMS --> ES
    APM --> PG
    APM --> RD
    APM --> ES
    APM --> PROM
    APM --> JAEG
    APM --> SMTP
    RPT --> PG
    RPT --> RD
    RPT --> ES
    RPT --> PROM
    RPT --> SMTP
    AI --> PG
    AI -->|"gRPC :50051"| PY

    OTELC --> PROM
    OTELC --> JAEG
    OTELC --> ES

    APM --> TEAMS
```

### 4.2 Data Flow Summary

| Flow | Path |
|------|------|
| **User Request** | Browser → Vite Proxy → Backend Service → PostgreSQL/Redis → Response |
| **Metrics Query** | Frontend → APM Service → Prometheus (PromQL) → Time-series data |
| **Log Search** | Frontend → APM Service → Elasticsearch (query DSL) → Log entries |
| **Trace Lookup** | Frontend → APM Service → Jaeger (Query API) → Span data |
| **Alert Evaluation** | Scheduler → APM Service → Prometheus/ES → SLA check → Alert state transition → Notify |
| **Report Generation** | Frontend → Report Service → Redis queue → Async worker → Prometheus/ES → PDF → Email |
| **AI Inference** | Frontend → AI Service → gRPC → Python Sidecar → ML model → Response |
| **Telemetry Ingest** | App (browser/backend) → OTel Collector → Prometheus + Jaeger + Elasticsearch |

---

## 5. End-to-End System Diagram

```mermaid
graph LR
    subgraph "Instrumented Applications"
        APP1["Microservice A"]
        APP2["Microservice B"]
        APP3["Frontend SPA"]
    end

    subgraph "Collection Layer"
        OTEL["OTel Collector"]
    end

    subgraph "Storage Layer"
        PROM["Prometheus<br/>(Metrics)"]
        ES["Elasticsearch<br/>(Logs)"]
        JAEGER["Jaeger<br/>(Traces)"]
        PG["PostgreSQL<br/>(Platform Data)"]
        REDIS["Redis<br/>(Cache/Queue)"]
    end

    subgraph "System Insight Platform"
        direction TB
        UMS["Auth & User Mgmt<br/>:8081"]
        APM_SVC["APM Core<br/>:8082"]
        RPT_SVC["Reports<br/>:8084"]
        AI_SVC["AI/ML Engine<br/>:8085"]
        ML["Python ML Sidecar<br/>:50051"]
    end

    subgraph "Presentation Layer"
        UI["React SPA<br/>:3000"]
    end

    subgraph "Notifications"
        EMAIL["Email (SMTP)"]
        SMS["SMS"]
        TEAMS["MS Teams"]
    end

    APP1 -->|OTel SDK| OTEL
    APP2 -->|OTel SDK| OTEL
    APP3 -->|OTel Web| OTEL

    OTEL --> PROM
    OTEL --> ES
    OTEL --> JAEGER

    APM_SVC --> PROM
    APM_SVC --> ES
    APM_SVC --> JAEGER
    APM_SVC --> PG
    APM_SVC --> REDIS
    RPT_SVC --> PROM
    RPT_SVC --> ES
    RPT_SVC --> PG
    RPT_SVC --> REDIS
    AI_SVC --> PG
    AI_SVC -->|gRPC| ML
    UMS --> PG
    UMS --> ES

    UI -->|REST API| UMS
    UI -->|REST API| APM_SVC
    UI -->|REST API| RPT_SVC
    UI -->|REST API| AI_SVC

    APM_SVC --> EMAIL
    APM_SVC --> SMS
    APM_SVC --> TEAMS
    RPT_SVC --> EMAIL
```

---

## 6. Backend Microservices Architecture

### 6.1 Service Inventory

| Service | Port | Responsibility | DB | External Integrations |
|---------|------|----------------|----|-----------------------|
| **observability-shared** | — | Shared library (auto-configured): exception handling, MDC logging, AOP tracing | — | — |
| **user-management-service** | 8081 | Authentication (JWT + OAuth2), RBAC, user/role CRUD, audit logging | PostgreSQL | Elasticsearch (audit), Azure AD |
| **apm-service** | 8082 | Service catalog, metrics/logs/traces queries, alerts, SLA rules, dashboards, workflows, dependencies | PostgreSQL | Prometheus, Elasticsearch, Jaeger, Redis, SMTP, MS Teams |
| **apm-report-service** | 8084 | Report generation (PDF), scheduled delivery, synthetic monitoring | PostgreSQL | Prometheus, Elasticsearch, Redis, SMTP |
| **apm-ai-service** | 8085 | ML inference bridge: anomaly detection, root-cause analysis, forecasting, LLM diagnosis | PostgreSQL | Python ML Sidecar (gRPC), OpenAI/Anthropic |

### 6.2 Backend Package Structure

```
backend/
├── observability-shared/          # Shared library
│   └── src/main/java/.../shared/
│       ├── dto/                   # ApiResponse, ErrorResponse, PagedResponse
│       ├── exception/             # ObservabilityException hierarchy
│       ├── filter/                # MdcLoggingFilter
│       ├── aspect/                # LoggingAspect
│       └── config/                # SharedAutoConfiguration
│
├── user-management-service/       # Auth & Users (Port 8081)
│   └── src/main/java/.../usermanagement/
│       ├── controller/            # AuthController, UserController, RoleController
│       ├── service/               # AuthService, UserService, RoleService
│       ├── repository/            # UserRepository, RoleRepository, etc.
│       ├── entity/                # User, Role, Permission, RefreshToken
│       ├── security/              # JwtTokenProvider, JwtFilter, SecurityConfig
│       └── config/                # RateLimitConfig, ElasticsearchConfig
│
├── apm-service/                   # Core APM (Port 8082)
│   └── src/main/java/.../apm/
│       ├── controller/            # 15+ controllers (Service, Metrics, Alerts, etc.)
│       ├── service/               # 20+ services (business logic)
│       ├── repository/            # JPA repositories
│       ├── entity/                # ServiceEntity, SlaRuleEntity, AlertEntity, etc.
│       ├── dto/                   # Request/Response DTOs
│       ├── mapper/                # MapStruct mappers
│       └── config/                # Redis, Prometheus, Security, Notification
│
├── apm-report-service/            # Reports & Synthetic (Port 8084)
│   └── src/main/java/.../report/
│       ├── controller/            # ReportController, SyntheticCheckController
│       ├── service/               # ReportService, PdfRenderingService, etc.
│       ├── repository/            # ReportRepository, SyntheticCheckRepository
│       └── entity/                # ReportEntity, SyntheticCheckEntity, etc.
│
└── apm-ai-service/                # AI/ML Engine (Port 8085)
    ├── src/main/java/.../ai/
    │   ├── controller/            # AiController
    │   ├── service/               # AiService (gRPC bridge)
    │   └── config/                # GrpcClientConfig, LlmConfig
    └── src/main/proto/
        └── ml_service.proto       # gRPC service definition
```

### 6.3 Scheduled Jobs

| Service | Job | Interval | Purpose |
|---------|-----|----------|---------|
| apm-service | Alert Evaluation Engine | ~60s | Evaluate SLA rules against Prometheus/ES, transition alert states |
| apm-service | Alert Notification Dispatch | Per-rule | Send notifications to channels with suppression/grouping |
| apm-report-service | Report Queue Processor | ~60s | Pick queued reports and generate PDFs |
| apm-report-service | Report Email Delivery | ~30s | Email completed scheduled reports |
| apm-report-service | Synthetic Check Executor | ~30s | Run HTTP probes on configured endpoints |
| apm-report-service | Report Retention Cleanup | Configurable | Purge expired report files |

---

## 7. Frontend Architecture

### 7.1 Application Structure

```
frontend/src/
├── main.tsx                       # Entry point (OTel init → React mount)
├── App.tsx                        # Root component
├── routes/index.tsx               # 24+ lazy-loaded routes
├── layouts/
│   ├── MainLayout.tsx             # Sidebar + AppBar + Outlet (13 nav items)
│   └── AuthLayout.tsx             # Minimal layout for login
├── pages/                         # Feature pages (lazy-loaded)
│   ├── auth/                      # LoginPage
│   ├── dashboard/                 # DashboardPage (home)
│   ├── dashboards/                # DashboardListPage, DashboardCanvasPage
│   ├── apm/                       # ApmOverviewPage
│   ├── services/                  # ServicesPage, ServiceDeepDivePage
│   ├── metrics/                   # MetricsExplorerPage (6 tabs)
│   ├── logs/                      # LogExplorerPage
│   ├── traces/                    # TraceViewerPage, TraceDetailPage
│   ├── alerts/                    # AlertsPage, AlertHistoryPage, SlaRulesPage
│   ├── dependencies/              # DependencyMapPage
│   ├── workflows/                 # WorkflowListPage, WorkflowBuilderPage, WorkflowDashboardPage
│   ├── reports/                   # ReportsPage
│   ├── synthetic/                 # SyntheticMonitoringPage
│   └── admin/                     # UsersPage, RolesPage, ProfilePage
├── services/                      # 18 API service files (Axios)
├── store/                         # Zustand stores (auth, theme, dashboard)
├── components/common/             # ErrorBoundary, GlobalSearchBar, LoadingSpinner
├── telemetry/                     # OTel Web SDK (config, SDK, instrumentations, propagator, Web Vitals)
├── theme/                         # MUI theming (palette, dark, accents)
├── hooks/                         # useAuth, useDebounce
├── types/                         # 1000+ lines of TypeScript interfaces
└── utils/                         # Utility functions
```

### 7.2 Route Map

```
/login                          → LoginPage (public)
/home                           → DashboardPage
/apm                            → ApmOverviewPage
/services                       → ServicesPage
/services/:serviceId            → ServiceDeepDivePage (5 tabs: Overview, Metrics, Logs, Traces, Dependencies)
/metrics                        → MetricsExplorerPage (6 tabs)
/logs                           → LogExplorerPage
/traces                         → TraceViewerPage
/traces/:traceId                → TraceDetailPage
/alerts                         → AlertsPage (Active + History tabs)
/sla-rules                      → SlaRulesPage
/dependencies                   → DependencyMapPage
/workflows                      → WorkflowListPage
/workflows/:workflowId          → WorkflowBuilderPage
/workflows/:workflowId/dashboard → WorkflowDashboardPage
/dashboards                     → DashboardListPage
/dashboards/:dashboardId        → DashboardCanvasPage
/reports                        → ReportsPage
/synthetic                      → SyntheticMonitoringPage
/admin/users                    → UsersPage
/admin/roles                    → RolesPage
/profile                        → ProfilePage
```

### 7.3 State Management

| Store | Library | Persistence | Purpose |
|-------|---------|-------------|---------|
| **authStore** | Zustand + persist | localStorage (`obs-auth`) | JWT tokens, user profile, login/logout/refresh actions |
| **themeStore** | Zustand + persist | localStorage (`obs-theme`) | Mode, accent, font, section colors |
| **dashboardStore** | Zustand | — | Dashboard editor state |

---

## 8. Database Design

### 8.1 Entity Relationship Overview

```mermaid
erDiagram
    users ||--o{ user_roles : has
    roles ||--o{ user_roles : assigned
    roles ||--o{ role_permissions : has
    permissions ||--o{ role_permissions : granted
    users ||--o{ refresh_tokens : owns

    services ||--o{ sla_rules : monitors
    services ||--o{ alerts : generates
    services ||--o{ dependencies : source
    services ||--o{ workflows : tracks
    sla_rules ||--o{ alerts : triggers
    sla_rules }o--o{ alert_channels : notifies
    workflows ||--o{ workflow_steps : contains
    workflows ||--o{ workflow_instances : executes
    workflow_instances ||--o{ workflow_instance_steps : tracks

    services ||--o{ synthetic_checks : monitors
    synthetic_checks ||--o{ synthetic_results : produces
    reports }o--|| services : scoped_to
    report_schedules }o--|| services : scoped_to

    users {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        string auth_provider
        boolean active
    }
    roles {
        uuid id PK
        string name UK
        string description
    }
    permissions {
        uuid id PK
        string resource
        string action
    }
    services {
        uuid id PK
        string name UK
        string environment
        string owner_team
        string tier
        boolean metrics_enabled
        boolean logs_enabled
        boolean traces_enabled
        boolean is_active
        string registration_source
    }
    sla_rules {
        uuid id PK
        uuid service_id FK
        string name
        string signal_type
        string metric_name
        string operator
        float threshold
        string severity
        int suppression_window
    }
    alerts {
        uuid id PK
        uuid sla_rule_id FK
        uuid service_id FK
        string state
        string severity
        float evaluated_value
        timestamp fired_at
        timestamp resolved_at
        string acknowledged_by
    }
    alert_channels {
        uuid id PK
        string name
        string channel_type
        jsonb config
        boolean enabled
    }
    dependencies {
        uuid id PK
        uuid source_service_id FK
        string target_service_name
        string dependency_type
        string target_type
        int call_count_1h
        int error_count_1h
    }
    dashboards {
        uuid id PK
        string name
        uuid owner_id
        boolean is_template
        jsonb widgets
    }
    workflows {
        uuid id PK
        string name
        string description
        boolean enabled
    }
    workflow_steps {
        uuid id PK
        uuid workflow_id FK
        int step_order
        string service_name
        string http_method
        string path_pattern
    }
    workflow_instances {
        uuid id PK
        uuid workflow_id FK
        string trace_id
        string status
        long total_duration_ms
    }
    reports {
        uuid id PK
        string name
        string report_type
        string status
        uuid service_id
        string file_path
    }
    report_schedules {
        uuid id PK
        string name
        string frequency
        string cron_expression
        string recipients
    }
    synthetic_checks {
        uuid id PK
        string name
        uuid service_id FK
        string url
        string schedule_cron
        int timeout_ms
    }
    synthetic_results {
        uuid id PK
        uuid check_id FK
        int status_code
        long latency_ms
        boolean success
    }
```

### 8.2 Database Distribution

| Database | Service | Tables | Migration Scripts |
|----------|---------|--------|-------------------|
| PostgreSQL (user-mgmt) | user-management-service | users, roles, permissions, user_roles, role_permissions, refresh_tokens | 3 Flyway scripts |
| PostgreSQL (apm) | apm-service | services, sla_rules, alerts, alert_channels, sla_rule_channels, dashboards, workflows, workflow_steps, workflow_instances, dependencies | 12 Flyway scripts |
| PostgreSQL (reports) | apm-report-service | reports, report_schedules, synthetic_checks, synthetic_results | 2 Flyway scripts |
| PostgreSQL (ai) | apm-ai-service | Minimal (inference-only) | — |

---

## 9. API Design & Conventions

### 9.1 Response Envelope

**Success:**
```json
{
  "success": true,
  "message": "Operation completed",
  "data": { },
  "timestamp": "2026-03-20T10:00:00Z"
}
```

**Error:**
```json
{
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Service not found",
  "path": "/api/v1/services/abc",
  "traceId": "req-uuid",
  "validationErrors": []
}
```

### 9.2 HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful read/update |
| 201 | Resource created |
| 202 | Async operation accepted (reports) |
| 204 | Successful delete |
| 400 | Validation error |
| 401 | Missing/invalid authentication |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 500 | Internal server error |

### 9.3 API Endpoint Summary

| Service | Base Path | Key Endpoints |
|---------|-----------|---------------|
| **Auth** | `/api/v1/auth` | POST `/login`, POST `/refresh`, POST `/logout`, GET `/me`, GET `/oauth2/callback` |
| **Users** | `/api/v1/users` | CRUD + PUT `/{id}/roles`, PUT `/{id}/password` |
| **Roles** | `/api/v1/roles` | CRUD + GET `/permissions`, PUT `/{id}/permissions` |
| **Services** | `/api/v1/services` | CRUD + PATCH `/{id}/signals`, GET `/filters` |
| **Metrics** | `/api/v1/services/{id}/metrics` | GET `/`, `/api`, `/infra`, `/ui`, `/query`, `/logs` |
| **Traces** | `/api/v1/services/{id}/traces` | GET `/`, `/operations`; GET `/traces/{traceId}`, `/span-breakup`, `/correlation` |
| **Logs** | `/api/v1/logs` | GET `/` (search), GET `/trace/{traceId}`, GET `/enrichment-validation` |
| **Alerts** | `/api/v1/alerts` | GET `/`, `/history`; POST `/{id}/acknowledge`, `/{id}/resolve` |
| **SLA Rules** | `/api/v1/sla-rules` | Full CRUD |
| **Alert Channels** | `/api/v1/alert-channels` | Full CRUD |
| **Dependencies** | `/api/v1/services/{id}/dependencies` | GET `/`, `/graph`, `/metrics`; POST `/extract` |
| **Dashboards** | `/api/v1/dashboards` | CRUD + POST `/clone`, GET `/templates`, POST `/widgets/resolve` |
| **Workflows** | `/api/v1/workflows` | CRUD + steps, instances, POST `/correlate/live`, GET `/steps/metrics` |
| **Reports** | `/api/v1/reports` | POST `/generate`, GET `/`, GET `/{id}/download`, DELETE `/{id}` |
| **Report Schedules** | `/api/v1/report-schedules` | Full CRUD |
| **Synthetic** | `/api/v1/synthetic-checks` | CRUD + GET `/{id}/results` |
| **AI** | `/api/v1/ai` | POST `/anomaly-detection`, `/root-cause`, `/forecast`, `/error-diagnosis`; GET `/health` |
| **APM Overview** | `/api/v1/apm/overview` | GET `/` (fleet health summary) |
| **Deep Dive** | `/api/v1/services/{id}/deep-dive` | GET `/` (service health composite) |
| **Time Ranges** | `/api/v1/metrics/time-ranges` | GET `/` (preset definitions) |

---

## 10. Security Architecture

### 10.1 Authentication Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant UMS as User Mgmt Service
    participant PG as PostgreSQL

    B->>UMS: POST /api/v1/auth/login {username, password}
    UMS->>PG: Lookup user by username
    PG-->>UMS: User entity (with BCrypt hash)
    UMS->>UMS: Verify BCrypt password
    UMS->>UMS: Generate JWT access token (15min)
    UMS->>PG: Store refresh token (7 days)
    UMS-->>B: {accessToken, refreshToken, expiresIn}
    Note over B: Store in Zustand + localStorage

    B->>UMS: GET /api/v1/users (Authorization: Bearer {token})
    UMS->>UMS: Validate JWT signature + expiry
    UMS->>UMS: Extract roles & permissions
    UMS-->>B: 200 OK with data
```

### 10.2 Security Summary

| Aspect | Implementation |
|--------|---------------|
| **Algorithm** | HMAC-SHA512 |
| **Access Token TTL** | 15 minutes |
| **Refresh Token TTL** | 7 days |
| **Password** | BCrypt (configurable strength) |
| **Session** | Stateless (no server-side sessions) |
| **RBAC** | User → Roles → Permissions (resource + action) |
| **OAuth2/OIDC** | Azure AD with auto-provisioning on first login |
| **Rate Limiting** | Token-bucket (10 req/s, 20 burst) on auth endpoints |
| **Frontend** | PrivateRoute HOC, role-based nav item visibility |

---

## 11. Sequence Diagrams

### 11.1 Service Health Deep Dive

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React SPA
    participant APM as APM Service
    participant PROM as Prometheus
    participant ES as Elasticsearch
    participant JAEG as Jaeger

    U->>FE: Navigate to /services/{id}
    FE->>APM: GET /api/v1/services/{id}/deep-dive?range=LAST_1H
    APM->>PROM: PromQL: rate(http_server_requests_total)
    PROM-->>APM: Latency P50/P95/P99, error rate, request rate
    APM->>ES: Query: service logs count, error ratio
    ES-->>APM: Log summary (total, errors, enrichment score)
    APM->>JAEG: Query: service traces (count, errors, avg duration)
    JAEG-->>APM: Trace summary + recent error traces
    APM->>APM: Calculate health score (weighted formula)
    APM-->>FE: ServiceDeepDiveResponse
    FE-->>U: Render Overview tab (health gauge, metrics, summaries)
```

### 11.2 Alert Lifecycle

```mermaid
sequenceDiagram
    participant SCH as Alert Scheduler
    participant APM as APM Service
    participant PROM as Prometheus
    participant PG as PostgreSQL
    participant SMTP as Email
    participant U as User

    SCH->>APM: Trigger evaluation cycle (every 60s)
    APM->>PG: Load enabled SLA rules
    loop For each SLA rule
        APM->>PROM: PromQL: evaluate metric condition
        PROM-->>APM: Current value
        APM->>APM: Compare value vs threshold
        alt Threshold breached
            APM->>PG: Transition alert state (OK→PENDING or PENDING→FIRING)
            alt State is FIRING
                APM->>PG: Load alert channels for rule
                APM->>SMTP: Send alert notification
                SMTP-->>APM: Delivered
            end
        else Threshold OK
            APM->>PG: Transition alert state → RESOLVED (if was firing)
        end
    end
    U->>APM: POST /alerts/{id}/acknowledge
    APM->>PG: Set acknowledgedBy, acknowledgedAt
    U->>APM: POST /alerts/{id}/resolve
    APM->>PG: Set state=RESOLVED, resolvedAt
```

### 11.3 Report Generation

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React SPA
    participant RPT as Report Service
    participant RD as Redis
    participant PROM as Prometheus
    participant ES as Elasticsearch
    participant SMTP as Email

    U->>FE: Click "Generate Report" (KPI, service X, last 7d)
    FE->>RPT: POST /api/v1/reports/generate
    RPT->>RPT: Create ReportEntity (status=QUEUED)
    RPT->>RD: Push to async task queue
    RPT-->>FE: 202 Accepted {reportId}

    Note over RPT,RD: Async worker picks up job
    RD-->>RPT: Dequeue report task
    RPT->>RPT: Set status=GENERATING
    RPT->>PROM: Fetch metrics (latency, error rate, throughput)
    PROM-->>RPT: Time-series data
    RPT->>ES: Fetch log aggregations
    ES-->>RPT: Log summary data
    RPT->>RPT: Render HTML via Thymeleaf template
    RPT->>RPT: Convert HTML → PDF (OpenHtmlToPdf)
    RPT->>RPT: Save to filesystem, set status=COMPLETED

    U->>FE: Click "Download"
    FE->>RPT: GET /api/v1/reports/{id}/download
    RPT-->>FE: PDF file stream
```

### 11.4 Distributed Trace Correlation

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React SPA
    participant APM as APM Service
    participant JAEG as Jaeger
    participant ES as Elasticsearch
    participant PROM as Prometheus

    U->>FE: Click trace in TraceViewerPage
    FE->>APM: GET /api/v1/traces/{traceId}
    APM->>JAEG: Fetch full trace (all spans)
    JAEG-->>APM: TraceDetailResponse (spans, services, durations)
    APM-->>FE: Render span waterfall

    U->>FE: Click "Correlation" tab
    FE->>APM: GET /api/v1/traces/{traceId}/correlation
    APM->>ES: Fetch logs with traceId={traceId}
    ES-->>APM: Related log entries
    APM->>PROM: Fetch service metrics at trace timestamp
    PROM-->>APM: Metrics snapshot
    APM-->>FE: CorrelationResponse (trace + logs + metrics)
    FE-->>U: Unified cross-signal view
```

### 11.5 AI Error Diagnosis

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React SPA
    participant AI as AI Service
    participant PY as Python ML Sidecar
    participant LLM as OpenAI / Anthropic

    U->>FE: Click "AI Suggestions" on trace detail
    FE->>AI: POST /api/v1/ai/error-diagnosis {spanData, logs, metrics}
    AI->>PY: gRPC ErrorDiagnosisRequest
    PY->>PY: Preprocess signals (feature extraction)
    PY->>LLM: LLM prompt with error context
    LLM-->>PY: Diagnosis + suggested fixes
    PY-->>AI: gRPC ErrorDiagnosisResponse
    AI-->>FE: {diagnosis, suggestions[], confidence}
    FE-->>U: Render AI suggestions panel
```

---

## 12. Observability & Telemetry Pipeline

### 12.1 Instrumentation Coverage

| Layer | Instrumentation | Signals |
|-------|----------------|---------|
| **Frontend (Browser)** | OTel Web SDK — fetch, XHR, document-load, user-interaction | Traces, Web Vitals |
| **Frontend → Backend** | W3C `traceparent` header via Axios interceptor | Distributed trace context |
| **Backend (Java)** | OTel Java SDK (auto-instrumentation via Spring Boot starter) | Traces, Metrics |
| **Backend Logging** | Logstash Logback Encoder → structured JSON with traceId/spanId | Logs (correlated) |
| **Backend Metrics** | Micrometer → Prometheus Registry → `/actuator/prometheus` | Metrics |

### 12.2 Telemetry Pipeline

```mermaid
graph LR
    subgraph "Sources"
        FE["Browser<br/>(OTel Web SDK)"]
        BE["Spring Boot<br/>(OTel Java SDK)"]
        LOG["Logback<br/>(JSON Encoder)"]
        MIC["Micrometer<br/>(Prometheus)"]
    end

    subgraph "Collection"
        OTEL["OTel Collector<br/>:4317 (gRPC) / :4318 (HTTP)"]
    end

    subgraph "Storage"
        PROM["Prometheus<br/>(TSDB)"]
        ES["Elasticsearch<br/>(Log Index)"]
        JAEG["Jaeger<br/>(Trace Store)"]
    end

    subgraph "Query Layer"
        APM["APM Service<br/>(Unified Query API)"]
    end

    FE -->|OTLP/HTTP| OTEL
    BE -->|OTLP/gRPC| OTEL
    LOG -->|Filebeat / Direct| ES
    MIC -->|Scrape :8082/actuator/prometheus| PROM

    OTEL -->|remote_write| PROM
    OTEL -->|OTLP export| JAEG
    OTEL -->|OTLP export| ES

    PROM --> APM
    ES --> APM
    JAEG --> APM
```

### 12.3 Web Vitals Collection

| Metric | Threshold (Good) | Collected By |
|--------|-------------------|--------------|
| **FCP** (First Contentful Paint) | < 1.8s | web-vitals lib → OTel span |
| **LCP** (Largest Contentful Paint) | < 2.5s | web-vitals lib → OTel span |
| **CLS** (Cumulative Layout Shift) | < 0.1 | web-vitals lib → OTel span |
| **INP** (Interaction to Next Paint) | < 200ms | web-vitals lib → OTel span |
| **TTFB** (Time to First Byte) | < 800ms | web-vitals lib → OTel span |

---

## 13. Deployment Topology

### 13.1 Service Ports

| Service | Port | Health Check | Metrics | API Docs |
|---------|------|-------------|---------|----------|
| Frontend (Vite) | 3000 | — | — | — |
| user-management-service | 8081 | `/actuator/health` | `/actuator/prometheus` | `/swagger-ui.html` |
| apm-service | 8082 | `/actuator/health` | `/actuator/prometheus` | `/swagger-ui.html` |
| apm-report-service | 8084 | `/actuator/health` | `/actuator/prometheus` | `/swagger-ui.html` |
| apm-ai-service | 8085 | `/actuator/health` | `/actuator/prometheus` | `/swagger-ui.html` |
| Python ML Sidecar | 50051 | gRPC health check | — | — |
| PostgreSQL | 5432 | — | — | — |
| Redis | 6379 | — | — | — |
| Elasticsearch | 9200 | — | — | — |
| Prometheus | 9090 | — | — | — |
| Jaeger | 16686 (UI) | — | — | — |
| OTel Collector | 4317/4318 | — | — | — |

### 13.2 Deployment Diagram

```mermaid
graph TB
    subgraph "Load Balancer / Reverse Proxy"
        LB["Nginx / Cloud LB"]
    end

    subgraph "Application Tier"
        FE["Frontend SPA<br/>(Static / CDN)"]
        UMS1["User Mgmt :8081"]
        UMS2["User Mgmt :8081"]
        APM1["APM Service :8082"]
        APM2["APM Service :8082"]
        RPT1["Report Service :8084"]
        AI1["AI Service :8085"]
        ML1["Python Sidecar :50051"]
    end

    subgraph "Data Tier"
        PG["PostgreSQL<br/>(Primary + Replica)"]
        RD["Redis<br/>(Cluster)"]
        ES["Elasticsearch<br/>(3-node cluster)"]
    end

    subgraph "Observability Tier"
        PROM["Prometheus<br/>(HA pair)"]
        JAEG["Jaeger<br/>(Collector + Query)"]
        OTEL["OTel Collector<br/>(Pool)"]
    end

    LB --> FE
    LB --> UMS1
    LB --> UMS2
    LB --> APM1
    LB --> APM2
    LB --> RPT1
    LB --> AI1
    AI1 --> ML1

    UMS1 --> PG
    UMS2 --> PG
    APM1 --> PG
    APM1 --> RD
    APM2 --> PG
    APM2 --> RD
    RPT1 --> PG
    RPT1 --> RD

    APM1 --> PROM
    APM1 --> ES
    APM1 --> JAEG
    RPT1 --> PROM
    RPT1 --> ES
```

---

## 14. Module Inventory

### Summary

| Dimension | Count |
|-----------|-------|
| Backend Services | 5 (incl. shared library) |
| Frontend Pages | 24+ |
| API Endpoints | 70+ |
| Database Tables | ~20 |
| Flyway Migrations | 17 |
| Frontend API Service Files | 18 |
| TypeScript Interfaces | 60+ (~1000 LOC) |
| Zustand Stores | 3 |
| Functional Modules | 13 |
| Supported Notification Channels | 3 (Email, SMS, MS Teams) |
| Dashboard Widget Types | 6 (Time Series, Bar, Pie, Table, Gauge, Stat) |
| Metrics Tabs | 6 (Service, API, Infra, UI, Query, Log) |
| OTel Instrumentations (FE) | 4 (Fetch, XHR, Doc Load, User Interaction) |

---

*Generated on 2026-03-20 for System Insight Platform v1.0*
