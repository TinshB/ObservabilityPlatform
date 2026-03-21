# User Stories — Metrics Engine & Log Explorer

| Field           | Detail                                              |
|-----------------|-----------------------------------------------------|
| **Document**    | User Stories — Sprint 5-7 (Metrics & Logs)          |
| **Version**     | 1.0                                                 |
| **Date**        | March 15, 2026                                      |
| **Author**      | Business Analysis Team                              |
| **Status**      | Ready for Sprint 5 Planning                         |
| **Reference**   | Observability Platform HLD v1.0, Sprint Plan v1.0   |
| **Sprint Scope**| Sprint 5, Sprint 6, Sprint 7                        |

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [Epic: Metrics Engine (Sprint 5-6)](#2-epic-metrics-engine-sprint-5-6)
3. [Epic: Log Explorer (Sprint 6-7)](#3-epic-log-explorer-sprint-6-7)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Open Questions](#5-open-questions)
6. [Revision History](#6-revision-history)

---

## 1. Document Purpose

This document captures the detailed user stories for two epics that constitute the core of Phase 2 (Core Observability):

- **Metrics Engine** — Covers all six metric levels (Service, UI, API, Query, Logs, Infra) spanning Sprint 5 and Sprint 6.
- **Log Explorer** — Covers service-level, API-level, and trace-level log capabilities spanning Sprint 6 and Sprint 7.

Each user story includes a unique identifier, role-based narrative, acceptance criteria in Given/When/Then format, story point estimate, priority classification, sprint assignment, and dependency references. These stories are intended to be directly consumable by the development team for sprint planning and execution.

### Roles Referenced

| Role     | Description                                                           |
|----------|-----------------------------------------------------------------------|
| Operator | Platform user who manages services, configures SLA, and monitors health |
| Viewer   | Read-only user who consumes dashboards, metrics, logs, and reports    |
| Admin    | Full-access user responsible for platform configuration and user management |

### API Endpoints Referenced

| Endpoint                                  | Description                     |
|-------------------------------------------|---------------------------------|
| `GET /api/v1/services/{id}/metrics`       | Query metrics for a service     |
| `GET /api/v1/services/{id}/logs`          | Query logs for a service        |
| `GET /api/v1/services`                    | List all registered services    |
| `GET /api/v1/services/{id}`              | Service detail with health summary |

---

## 2. Epic: Metrics Engine (Sprint 5-6)

**Epic Summary:** Build a comprehensive metrics query layer and visualization UI that enables users to inspect all six metric levels for any registered service. All metrics are sourced from Prometheus via PromQL queries, exposed through the Spring Boot backend API, and rendered in the React SPA.

**Data Sources:** Prometheus (PromQL), OTel SDK, OTel Browser SDK, JDBC instrumentation, node-exporter, cAdvisor, Elasticsearch aggregation.

---

### MET-001: Service-Level Metrics — Latency, Error Rate, Request Rate, and Saturation

**Title:** View service-level golden signals for a registered service

**User Story:**
As an **Operator**, I want to view the golden signals (request rate, error rate, latency P50/P95/P99, and saturation) for any registered service over a configurable time range, so that I can quickly assess the health of a service and detect anomalies.

**Acceptance Criteria:**

1. **Given** I am an authenticated Operator or Viewer and I navigate to the Metrics Explorer page,
   **When** I select a registered service from the service selector dropdown,
   **Then** the system queries `GET /api/v1/services/{id}/metrics?level=service` and displays time-series charts for request rate (req/s), error rate (%), and latency percentiles (P50, P95, P99) within 3 seconds.

2. **Given** service-level metrics are displayed for a selected service,
   **When** I change the time range using the time-range picker (e.g., last 15m, 1h, 6h, 24h, 7d, or custom range),
   **Then** all service-level charts re-render with data scoped to the selected time range and the PromQL query `step` parameter adjusts resolution accordingly (e.g., 15s step for 1h range, 1m step for 24h range).

3. **Given** the selected service has a saturation metric configured (e.g., thread pool utilization, connection pool usage),
   **When** the service-level metrics panel loads,
   **Then** a saturation gauge or chart is displayed alongside the golden signals showing the current saturation percentage and its trend over the selected time range.

4. **Given** service-level metrics are rendered as time-series charts,
   **When** I hover over any data point on a chart,
   **Then** a tooltip displays the exact timestamp, metric name, and value (e.g., "2026-06-12 14:32:15 | P95 Latency: 142ms").

5. **Given** I am a user with the Viewer role,
   **When** I access the Metrics Explorer and select a service,
   **Then** I can view all service-level metrics in read-only mode with no configuration controls visible.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 8                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S5                                                           |
| **Owner POD**    | POD 2 (Backend), POD 3 (Frontend)                            |
| **Dependencies** | S4 Service Catalog (services registered), Prometheus deployed (S1), OTel Collector pipeline active (S4) |

---

### MET-002: API-Level Metrics — Per-Endpoint Latency Histogram, Status Codes, and Throughput

**Title:** View per-endpoint latency, status code distribution, and throughput

**User Story:**
As an **Operator**, I want to view latency histograms (P50/P95/P99), status code distribution, and throughput for each API endpoint of a service, so that I can pinpoint slow or error-prone endpoints and prioritize optimization efforts.

**Acceptance Criteria:**

1. **Given** I am viewing the Metrics Explorer for a selected service,
   **When** I navigate to the "API Metrics" tab and select an endpoint from the endpoint dropdown (populated from discovered HTTP routes),
   **Then** the system displays a latency histogram showing P50, P95, and P99 response times for that endpoint over the selected time range.

2. **Given** an endpoint is selected in the API Metrics panel,
   **When** the panel loads,
   **Then** a status code distribution chart (stacked bar or donut) shows the breakdown of 2xx, 3xx, 4xx, and 5xx responses for the selected time range, with counts and percentages.

3. **Given** an endpoint is selected in the API Metrics panel,
   **When** the panel loads,
   **Then** a throughput chart displays requests per second (RPS) as a time-series line chart for the selected endpoint and time range.

4. **Given** no endpoint is explicitly selected,
   **When** the API Metrics tab loads,
   **Then** an aggregated summary table lists all discovered endpoints for the service, showing columns: Route, Method, Avg Latency, P99 Latency, Error Rate (%), and RPS, sorted by error rate descending by default.

5. **Given** I click on a row in the endpoint summary table,
   **When** the row is selected,
   **Then** the detail charts (latency histogram, status code distribution, throughput) update to reflect the selected endpoint.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S5                                                           |
| **Owner POD**    | POD 2 (Backend), POD 3 (Frontend)                            |
| **Dependencies** | MET-001 (shared Metrics Explorer shell), OTel SDK auto-instrumentation emitting per-route metrics |

---

### MET-003: Infrastructure-Level Metrics — CPU, Memory, Disk I/O, Network, GC Pause

**Title:** View infrastructure metrics for service pods and host nodes

**User Story:**
As an **Operator**, I want to view infrastructure-level metrics (CPU utilization, memory usage, disk I/O, network bytes in/out, and JVM GC pause time) for the pods and nodes running a selected service, so that I can identify resource bottlenecks and plan capacity.

**Acceptance Criteria:**

1. **Given** I am viewing the Metrics Explorer for a selected service,
   **When** I navigate to the "Infra Metrics" tab,
   **Then** the system displays CPU utilization (%) and memory usage (%) as gauge charts showing the current value, and as time-series line charts showing the trend over the selected time range.

2. **Given** the Infra Metrics tab is active,
   **When** the panel loads,
   **Then** disk I/O (read/write bytes per second) and network throughput (bytes in/out per second) are displayed as dual-axis time-series charts.

3. **Given** the selected service is a JVM-based application (Java/Spring Boot),
   **When** the Infra Metrics tab loads,
   **Then** a GC pause time chart is displayed showing pause duration and frequency over the selected time range, sourced from the `jvm_gc_pause_seconds` Prometheus metric.

4. **Given** the service is running across multiple pods,
   **When** the Infra Metrics tab loads,
   **Then** a pod selector allows the user to view metrics for an individual pod or an aggregated view across all pods (default: aggregated).

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S5                                                           |
| **Owner POD**    | POD 1 (node-exporter/cAdvisor deployment), POD 2 (Backend), POD 3 (Frontend) |
| **Dependencies** | node-exporter DaemonSet and cAdvisor deployed (S5.8), Prometheus scrape configs for node and container metrics |

---

### MET-004: Time Range and Resolution Controls

**Title:** Configure time range and query resolution for all metric panels

**User Story:**
As a **Viewer**, I want to select a time range and have the system automatically adjust the query resolution, so that metric charts render an appropriate level of detail without overloading the browser or backend.

**Acceptance Criteria:**

1. **Given** I am on any Metrics Explorer panel (service, API, infra, UI, query, or logs level),
   **When** I select a predefined time range (15m, 1h, 6h, 24h, 7d),
   **Then** the PromQL `start`, `end`, and `step` parameters are set accordingly and all visible charts re-render within 3 seconds.

2. **Given** I want to investigate a specific incident window,
   **When** I select "Custom Range" and specify a start datetime and end datetime using the date-time picker,
   **Then** the system validates that start < end, the range does not exceed 30 days, and queries are executed for the custom window.

3. **Given** I have selected a time range,
   **When** the charts render,
   **Then** the system applies an adaptive resolution strategy: ranges <= 1h use 15s step, 1h-6h use 1m step, 6h-24h use 5m step, 1d-7d use 15m step, 7d-30d use 1h step.

4. **Given** I change the time range on the Metrics Explorer page,
   **When** the new range is applied,
   **Then** all metric panels on the current view (service, API, infra) update simultaneously using the new time range, maintaining a consistent temporal context.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 3                                                            |
| **Priority**     | P1                                                           |
| **Sprint**       | S5                                                           |
| **Owner POD**    | POD 2 (Backend), POD 3 (Frontend)                            |
| **Dependencies** | MET-001 (Metrics Explorer shell)                             |

---

### MET-005: UI-Level Metrics — Core Web Vitals (FCP, LCP, CLS, TTI)

**Title:** View Core Web Vitals metrics from browser instrumentation

**User Story:**
As an **Operator**, I want to view UI performance metrics (First Contentful Paint, Largest Contentful Paint, Cumulative Layout Shift, and Time to Interactive) collected from real-user browser sessions via the OTel Browser SDK, so that I can assess front-end performance and identify user experience degradations.

**Acceptance Criteria:**

1. **Given** I am viewing the Metrics Explorer for a service that has the OTel Browser SDK enabled,
   **When** I navigate to the "Web Vitals" tab,
   **Then** the system queries `GET /api/v1/services/{id}/metrics?level=ui` and displays FCP, LCP, CLS, and TTI as individual time-series charts showing percentile trends (P50, P75, P95) over the selected time range.

2. **Given** Web Vitals metrics are displayed,
   **When** I view the charts,
   **Then** each chart includes color-coded threshold bands based on Google's Core Web Vitals thresholds (e.g., LCP: green <= 2.5s, amber 2.5-4.0s, red > 4.0s) so that performance is immediately interpretable.

3. **Given** the selected service does not have browser SDK telemetry (e.g., it is a backend-only service),
   **When** I navigate to the Web Vitals tab,
   **Then** the tab displays an informational message: "No UI-level metrics available. This service does not emit browser telemetry. Enable the OTel Browser SDK to collect Web Vitals."

4. **Given** Web Vitals metrics are available,
   **When** I view the Web Vitals tab,
   **Then** a summary card at the top shows the latest P75 value for each metric (FCP, LCP, CLS, TTI) with a green/amber/red status indicator and a delta compared to the previous period.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S6                                                           |
| **Owner POD**    | POD 2 (Backend), POD 3 (Frontend)                            |
| **Dependencies** | OTel Browser SDK integration on monitored front-end apps, MET-004 (time range controls) |

---

### MET-006: Query-Level Metrics — SQL Execution Time, Rows Scanned, Slow-Query Detection

**Title:** View database query performance metrics with slow-query identification

**User Story:**
As an **Operator**, I want to view query-level metrics including SQL execution time, rows scanned versus rows returned, and a slow-query flag for each service, so that I can identify inefficient database queries and prioritize query optimization.

**Acceptance Criteria:**

1. **Given** I am viewing the Metrics Explorer for a service that uses a relational database,
   **When** I navigate to the "Query Metrics" tab,
   **Then** the system queries `GET /api/v1/services/{id}/metrics?level=query` and displays a table of observed query patterns with columns: Query Fingerprint (parameterized), Avg Execution Time (ms), P95 Execution Time (ms), Avg Rows Scanned, Avg Rows Returned, Call Count, and Slow Query Flag.

2. **Given** the Query Metrics table is displayed,
   **When** a query's P95 execution time exceeds the configurable slow-query threshold (default: 500ms),
   **Then** the row is flagged with a visual "Slow" indicator (e.g., red badge) and the row is highlighted.

3. **Given** I click on a query fingerprint row in the table,
   **When** the detail panel expands,
   **Then** I see a time-series chart of execution time (P50, P95, P99) for that specific query over the selected time range, plus a scatter plot of rows scanned vs. rows returned.

4. **Given** the service does not have JDBC instrumentation enabled,
   **When** I navigate to the Query Metrics tab,
   **Then** the system displays an informational message: "No query-level metrics available. Enable JDBC instrumentation for this service to collect SQL performance data."

5. **Given** the Query Metrics table is displayed,
   **When** I click the "Sort by" dropdown,
   **Then** I can sort by any column (execution time, rows scanned, call count, slow flag) and the default sort is P95 Execution Time descending.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S6                                                           |
| **Owner POD**    | POD 2 (Backend), POD 3 (Frontend)                            |
| **Dependencies** | JDBC auto-instrumentation via OTel SDK on monitored services, MET-004 (time range controls) |

---

### MET-007: Logs-Level Metrics — Log Volume, Error Ratio, and Pattern Frequency

**Title:** View log-derived metrics showing volume, error ratio, and pattern distribution

**User Story:**
As an **Operator**, I want to view aggregated log metrics including log volume per severity level, error log ratio, and top log message patterns for a service, so that I can detect logging anomalies, error spikes, and noisy log patterns that may need attention.

**Acceptance Criteria:**

1. **Given** I am viewing the Metrics Explorer for a selected service,
   **When** I navigate to the "Log Metrics" tab,
   **Then** the system queries `GET /api/v1/services/{id}/metrics?level=logs` and displays a stacked area chart showing log volume over time, broken down by severity level (DEBUG, INFO, WARN, ERROR, FATAL).

2. **Given** log metrics are displayed,
   **When** the Log Metrics panel loads,
   **Then** an error log ratio gauge shows the percentage of ERROR + FATAL logs relative to total log volume for the selected time range, with a configurable warning threshold (default: 5%).

3. **Given** log metrics are available,
   **When** the Log Metrics panel loads,
   **Then** a "Top Patterns" section displays the 10 most frequent log message patterns (de-duplicated by template), showing pattern text, frequency count, percentage of total, and trend direction (increasing/stable/decreasing).

4. **Given** I click on a log pattern in the Top Patterns list,
   **When** the pattern is selected,
   **Then** the system navigates to the Log Explorer (Epic 2) with a pre-applied filter matching that pattern, enabling deeper investigation.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P1                                                           |
| **Sprint**       | S6                                                           |
| **Owner POD**    | POD 2 (Backend), POD 3 (Frontend)                            |
| **Dependencies** | Elasticsearch aggregation pipeline, Log indexing active (OTel Collector -> ES), LOG-001 (for cross-link to Log Explorer) |

---

### MET-008: Metrics Accuracy Validation and Data Freshness Indicator

**Title:** Display data freshness indicator and ensure metric accuracy against ingested data

**User Story:**
As an **Operator**, I want to see a data freshness indicator on the Metrics Explorer showing when the last data point was received, and I want confidence that displayed metrics accurately reflect the ingested telemetry, so that I can trust the data I am using to make operational decisions.

**Acceptance Criteria:**

1. **Given** I am viewing any metric panel on the Metrics Explorer,
   **When** the panel renders,
   **Then** a "Last data received" timestamp is displayed in the panel header showing the timestamp of the most recent data point for the selected metric, updated on each query refresh.

2. **Given** the last data point for a metric is older than 5 minutes,
   **When** the panel renders,
   **Then** the data freshness indicator turns amber with the label "Data may be stale" and includes the age (e.g., "Last data: 12 minutes ago").

3. **Given** no data exists for a metric within the selected time range,
   **When** the panel renders,
   **Then** the panel displays a "No data available" state with a suggestion to check that the OTel pipeline is active and the service is emitting telemetry.

4. **Given** a QA engineer is validating metric accuracy,
   **When** a known load test generates exactly N requests with a known error distribution,
   **Then** the service-level metrics (request count, error count, latency percentiles) displayed in the Metrics Explorer match the expected values within a 2% tolerance.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S5                                                           |
| **Owner POD**    | POD 2 (Backend), QA                                          |
| **Dependencies** | MET-001 (Metrics Explorer base), Prometheus data available   |

---

### MET-009: Metrics Explorer Service Selector and Navigation

**Title:** Navigate the Metrics Explorer with service selection and tab-based metric levels

**User Story:**
As a **Viewer**, I want to select any registered service from a searchable dropdown and navigate between metric level tabs (Service, API, Infra, Web Vitals, Query, Log Metrics), so that I have a single, consistent entry point for exploring all metric dimensions of a service.

**Acceptance Criteria:**

1. **Given** I am an authenticated user with at least Viewer role,
   **When** I navigate to the Metrics Explorer page,
   **Then** a searchable service selector dropdown loads all registered services from `GET /api/v1/services` with service name, environment tag, and health status indicator.

2. **Given** I have selected a service in the service selector,
   **When** the Metrics Explorer loads,
   **Then** six tabs are displayed: "Service", "API", "Infra", "Web Vitals", "Query", and "Log Metrics", with the "Service" tab active by default.

3. **Given** I switch between metric level tabs,
   **When** I click on a different tab,
   **Then** the selected time range persists across tab switches and the new tab's data loads without requiring me to re-select the service or time range.

4. **Given** I want to share a specific metric view with a colleague,
   **When** I select a service, tab, and time range,
   **Then** the browser URL updates to reflect the current state (e.g., `/metrics?service=order-svc&level=api&range=1h`) so the view is bookmarkable and shareable.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S5                                                           |
| **Owner POD**    | POD 3 (Frontend)                                             |
| **Dependencies** | Service Catalog API (S4), React app shell (S1)               |

---

### MET-010: Metric Auto-Refresh and Live Tail Mode

**Title:** Enable auto-refresh and live tail mode for real-time metric monitoring

**User Story:**
As an **Operator**, I want the Metrics Explorer to support configurable auto-refresh intervals and a live tail mode, so that I can monitor service health in real-time during incidents or deployments without manually refreshing.

**Acceptance Criteria:**

1. **Given** I am viewing the Metrics Explorer,
   **When** I enable auto-refresh from the toolbar,
   **Then** I can select a refresh interval (10s, 30s, 1m, 5m) and the active metric panels re-query and re-render at the selected interval.

2. **Given** auto-refresh is enabled,
   **When** the refresh cycle executes,
   **Then** the time range window shifts forward automatically (sliding window) so that the most recent data is always visible (e.g., "last 1h" always ends at "now").

3. **Given** auto-refresh is active,
   **When** I manually change the time range or interact with a chart (e.g., zoom, hover),
   **Then** auto-refresh pauses temporarily to avoid disrupting the user interaction, and resumes after 30 seconds of inactivity.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 3                                                            |
| **Priority**     | P1                                                           |
| **Sprint**       | S6                                                           |
| **Owner POD**    | POD 3 (Frontend)                                             |
| **Dependencies** | MET-001 (Metrics Explorer base), MET-004 (time range controls) |

---

## 3. Epic: Log Explorer (Sprint 6-7)

**Epic Summary:** Build a full-featured Log Explorer that enables users to search, filter, and browse application logs at three scoping levels: service-level (all logs for a service), API-level (logs scoped to an HTTP route), and trace-level (logs correlated by traceId). Logs are stored in Elasticsearch 8.x and queried via the backend's Elasticsearch Query DSL abstraction layer, exposed through `GET /api/v1/services/{id}/logs`.

**Data Sources:** Elasticsearch 8.x (full-text search, structured filters, aggregations). Logs are enriched with `traceId`, `spanId`, `service.name`, `deployment.environment`, and custom resource attributes by the OTel Collector before indexing.

---

### LOG-001: Service-Level Log Browsing with Severity, Environment, and Time-Range Filters

**Title:** Browse and filter service logs by severity, environment, and time range

**User Story:**
As an **Operator**, I want to browse logs for a selected service filtered by severity level, environment, and time range, so that I can investigate issues by narrowing down to the relevant log entries without manually querying Elasticsearch.

**Acceptance Criteria:**

1. **Given** I am an authenticated user with at least Viewer role and I navigate to the Log Explorer page,
   **When** I select a service from the service selector,
   **Then** the system queries `GET /api/v1/services/{id}/logs` and displays the most recent log entries (default: last 1 hour) in a scrollable table with columns: Timestamp, Severity, Service, Message (truncated to first 200 characters), TraceId.

2. **Given** the Log Explorer is displaying logs for a service,
   **When** I select one or more severity levels from the severity filter (DEBUG, INFO, WARN, ERROR, FATAL),
   **Then** the log table immediately re-queries and displays only logs matching the selected severity levels, with the result count updated.

3. **Given** the Log Explorer is displaying logs for a service,
   **When** I select an environment from the environment filter dropdown (e.g., dev, staging, production),
   **Then** only logs tagged with the selected `deployment.environment` value are displayed.

4. **Given** I apply multiple filters (severity + environment + time range),
   **When** the query executes,
   **Then** all filters are applied as a boolean AND conjunction and the result count badge updates to show "Showing X of Y total logs".

5. **Given** the log result set exceeds 100 entries,
   **When** the initial query returns,
   **Then** the log table displays the first 100 entries with cursor-based pagination controls ("Load more" button or infinite scroll) to fetch subsequent pages without re-executing the entire query.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 8                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S6                                                           |
| **Owner POD**    | POD 2 (Backend — ES Query DSL abstraction), POD 3 (Frontend) |
| **Dependencies** | Elasticsearch deployed with log index templates (S1), OTel Collector log pipeline active (S4), Service Catalog (S4) |

---

### LOG-002: Full-Text Log Search

**Title:** Search log messages using full-text search with query highlighting

**User Story:**
As an **Operator**, I want to perform full-text searches across log messages for a selected service, so that I can find specific error messages, stack traces, or keywords across large volumes of log data.

**Acceptance Criteria:**

1. **Given** I am on the Log Explorer with a service selected,
   **When** I type a search query (e.g., "NullPointerException", "connection refused", "timeout") into the search bar and press Enter or click Search,
   **Then** the system sends the query to `GET /api/v1/services/{id}/logs?q={searchTerm}` using Elasticsearch full-text search and displays matching log entries sorted by relevance score (default) or timestamp.

2. **Given** full-text search results are displayed,
   **When** I view the log entries,
   **Then** the matching search terms are highlighted within the log message text using visual emphasis (e.g., bold or background color).

3. **Given** I want to perform an advanced search,
   **When** I use Elasticsearch query syntax in the search bar (e.g., `message:"connection refused" AND severity:ERROR`),
   **Then** the system passes the query to the backend as a structured query and returns correctly filtered results.

4. **Given** a full-text search returns no results,
   **When** the empty result state renders,
   **Then** the Log Explorer displays "No logs matching your search" with suggestions: "Try broadening your time range", "Check your search syntax", "Verify the service is emitting logs".

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S6                                                           |
| **Owner POD**    | POD 2 (Backend — ES full-text query), POD 3 (Frontend)       |
| **Dependencies** | LOG-001 (Log Explorer base), Elasticsearch full-text indexing on log message field |

---

### LOG-003: API-Level Log Filtering — Scope Logs by HTTP Route and Method

**Title:** Filter logs scoped to a specific API endpoint (route + method)

**User Story:**
As an **Operator**, I want to filter logs by HTTP route and method so that I can see all log entries generated during the handling of requests to a specific API endpoint, enabling targeted debugging of endpoint-specific issues.

**Acceptance Criteria:**

1. **Given** I am on the Log Explorer with a service selected,
   **When** I open the "API Filter" panel,
   **Then** the system displays a dropdown of discovered HTTP routes for the selected service (e.g., `GET /api/v1/orders`, `POST /api/v1/orders/{id}/cancel`) populated from indexed log metadata or the service catalog.

2. **Given** I select an HTTP route and method from the API filter,
   **When** the filter is applied,
   **Then** the system queries `GET /api/v1/services/{id}/logs?route=/api/v1/orders&method=POST` and displays only log entries that were generated during the processing of requests matching that route and method.

3. **Given** I have an API-level filter active,
   **When** I also apply severity and time range filters,
   **Then** all filters combine (AND conjunction): the results show only logs for the selected route + method + severity + time range.

4. **Given** I have applied an API-level filter,
   **When** I view the active filter bar,
   **Then** a removable filter chip displays the active API filter (e.g., "Route: POST /api/v1/orders/{id}/cancel") and clicking the "x" on the chip removes only that filter.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 3                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S6                                                           |
| **Owner POD**    | POD 2 (Backend), POD 3 (Frontend)                            |
| **Dependencies** | LOG-001 (Log Explorer base), OTel SDK HTTP route attribute enrichment in log records |

---

### LOG-004: Trace-Level Log Correlation — View All Logs for a TraceId

**Title:** View all log entries correlated to a specific distributed trace

**User Story:**
As an **Operator**, I want to view all log entries associated with a given `traceId` in chronological order across all services that participated in the trace, so that I can understand the full causal context of a distributed request when diagnosing failures.

**Acceptance Criteria:**

1. **Given** I am on the Log Explorer,
   **When** I enter a `traceId` in the trace correlation search field (or click a traceId link from a log entry),
   **Then** the system queries `GET /api/v1/services/{id}/logs?traceId={traceId}` (or a cross-service trace log endpoint) and displays all log entries across all services that share the given traceId, ordered by timestamp ascending.

2. **Given** trace-correlated logs are displayed,
   **When** I view the log table,
   **Then** each log entry shows the `service.name` that emitted it, and logs are visually grouped or color-coded by service so I can distinguish which service produced each log entry.

3. **Given** trace-correlated logs are displayed,
   **When** I view a log entry,
   **Then** the `spanId` is shown alongside the `traceId` and I can see which span within the trace generated the log entry.

4. **Given** a traceId is entered that does not match any indexed logs,
   **When** the query returns empty results,
   **Then** the system displays "No logs found for trace ID {traceId}. The trace may not have emitted logs, or logs may have been rotated." with a link to search for the trace in the Trace Viewer instead.

5. **Given** trace-correlated logs are displayed,
   **When** I click the "View Trace" button in the log correlation panel,
   **Then** the system navigates to the Trace Viewer (Sprint 7-8 scope) with the traceId pre-populated.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S7                                                           |
| **Owner POD**    | POD 2 (Backend), POD 3 (Frontend)                            |
| **Dependencies** | LOG-001 (Log Explorer base), OTel log enrichment with traceId/spanId (S4 pipeline), Elasticsearch traceId field indexed as keyword |

---

### LOG-005: Log Entry Detail View with Structured Fields

**Title:** Expand a log entry to view full message and all structured fields

**User Story:**
As an **Operator**, I want to expand any log entry in the Log Explorer to see the full log message and all structured metadata fields, so that I can inspect the complete context of a log event without needing to query Elasticsearch directly.

**Acceptance Criteria:**

1. **Given** I am viewing the Log Explorer with log entries displayed in the table,
   **When** I click on a log entry row,
   **Then** an expandable detail panel opens below the row showing the full (un-truncated) log message and all structured fields as key-value pairs (e.g., traceId, spanId, service.name, deployment.environment, host.name, log.level, custom attributes).

2. **Given** the log detail panel is expanded,
   **When** I view a structured field value,
   **Then** I can click on the field value to add it as a filter (e.g., clicking a traceId value adds a traceId filter, clicking a severity value adds a severity filter).

3. **Given** a log entry contains a multi-line message (e.g., a Java stack trace),
   **When** the detail panel renders the message,
   **Then** the message is displayed in a monospaced font with preserved line breaks and whitespace formatting, and a "Copy" button copies the full message to the clipboard.

4. **Given** the log detail panel is expanded,
   **When** I click the "View in Context" link,
   **Then** the Log Explorer scrolls to show the 10 log entries before and after the selected entry (from the same service, ordered by timestamp) to provide temporal context.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 3                                                            |
| **Priority**     | P1                                                           |
| **Sprint**       | S6                                                           |
| **Owner POD**    | POD 3 (Frontend)                                             |
| **Dependencies** | LOG-001 (Log Explorer base with log table)                   |

---

### LOG-006: Log Enrichment Validation — Verify OTel Metadata Injection

**Title:** Validate that log entries are enriched with traceId, spanId, and resource attributes

**User Story:**
As a **QA Engineer**, I want to verify that all log entries indexed in Elasticsearch are enriched with the required OTel resource attributes (traceId, spanId, service.name, deployment.environment), so that log correlation, filtering, and navigation features function correctly.

**Acceptance Criteria:**

1. **Given** a monitored service processes an incoming request that generates a distributed trace,
   **When** the service emits log entries during request processing,
   **Then** each log entry indexed in Elasticsearch contains a non-null `traceId` field matching the active trace and a `spanId` field matching the current span.

2. **Given** a log entry is indexed in Elasticsearch,
   **When** I inspect the document fields,
   **Then** the `service.name` field matches the registered service name in the Service Catalog and the `deployment.environment` field reflects the deployment environment (dev, staging, production).

3. **Given** log entries are emitted without an active trace context (e.g., background jobs, startup logs),
   **When** the log entry is indexed,
   **Then** the `traceId` and `spanId` fields are either absent or set to a sentinel value (e.g., "0000000000000000") and the log entry is still filterable by service name and severity.

4. **Given** the OTel Collector pipeline processes a log record,
   **When** the log is exported to Elasticsearch,
   **Then** the Collector's resource processor has injected all configured custom resource attributes (e.g., `k8s.pod.name`, `k8s.namespace.name`) into the log document.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 3                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S7                                                           |
| **Owner POD**    | POD 1 (OTel pipeline), QA                                    |
| **Dependencies** | OTel Collector configuration (S4), Elasticsearch log index template (S1) |

---

### LOG-007: Log-to-Trace Navigation Link

**Title:** Navigate from a log entry to the associated trace in the Trace Viewer

**User Story:**
As an **Operator**, I want to click on a traceId within a log entry and be navigated directly to the Trace Viewer showing the full distributed trace, so that I can seamlessly move from log investigation to trace analysis without manually copying and searching for the trace ID.

**Acceptance Criteria:**

1. **Given** I am viewing a log entry in the Log Explorer that has a non-null `traceId`,
   **When** I view the log table or the expanded detail panel,
   **Then** the `traceId` value is rendered as a clickable hyperlink.

2. **Given** I click on a traceId hyperlink in a log entry,
   **When** the navigation executes,
   **Then** the application navigates to the Trace Viewer page at `/traces/{traceId}` with the trace detail pre-loaded.

3. **Given** the Trace Viewer page is not yet available (Sprint 7-8 implementation in progress),
   **When** I click on a traceId hyperlink,
   **Then** the system navigates to a placeholder page showing "Trace Viewer coming soon — Trace ID: {traceId}" so the link structure is established for future integration.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 3                                                            |
| **Priority**     | P0                                                           |
| **Sprint**       | S7                                                           |
| **Owner POD**    | POD 3 (Frontend)                                             |
| **Dependencies** | LOG-001 (Log Explorer with traceId display), Trace Viewer (S7 — parallel development) |

---

### LOG-008: Log Explorer Auto-Refresh and Live Tail

**Title:** Stream new log entries in real-time with live tail mode

**User Story:**
As an **Operator**, I want the Log Explorer to support a live tail mode that streams new log entries as they are indexed, so that I can monitor logs in real-time during incident response or deployment verification.

**Acceptance Criteria:**

1. **Given** I am on the Log Explorer with a service and filters selected,
   **When** I click the "Live Tail" toggle button,
   **Then** the Log Explorer switches to live mode: the time range selector is replaced with a "Live" indicator, and new log entries appear at the top of the log table as they are indexed in Elasticsearch (polling interval: 3 seconds).

2. **Given** live tail mode is active,
   **When** new log entries arrive,
   **Then** the entries animate into view at the top of the table and the log count badge increments, while existing entries shift down.

3. **Given** live tail mode is active,
   **When** I scroll down in the log table to view older entries,
   **Then** auto-scrolling pauses and a "New entries available" banner appears at the top; clicking the banner scrolls back to the top and resumes auto-scrolling.

4. **Given** live tail mode is active,
   **When** I click the "Live Tail" toggle button again to disable it,
   **Then** the Log Explorer returns to the standard time-range mode with the logs frozen at the current state, and the time range selector re-appears.

| Attribute        | Value                                                        |
|------------------|--------------------------------------------------------------|
| **Story Points** | 5                                                            |
| **Priority**     | P1                                                           |
| **Sprint**       | S7                                                           |
| **Owner POD**    | POD 2 (Backend — polling or SSE endpoint), POD 3 (Frontend)  |
| **Dependencies** | LOG-001 (Log Explorer base), Backend polling or Server-Sent Events mechanism |

---

## 4. Non-Functional Requirements

The following non-functional requirements apply to both the Metrics Engine and Log Explorer epics.

### 4.1 Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| API response time for metric queries (P95) | < 200 ms | Measured at Spring Boot backend, excluding network latency to client |
| API response time for log queries with filters (P95) | < 300 ms | Measured for queries returning up to 100 log entries |
| API response time for full-text log search (P95) | < 500 ms | Measured for queries matching up to 10,000 documents (first page) |
| UI chart render time after data receipt | < 1 second | Measured from API response arrival to chart fully rendered in browser |
| Live tail polling latency | < 5 seconds end-to-end | Time from log indexing in ES to display in UI |

### 4.2 Data Retention

| Data Type | Retention Period | Storage Backend |
|-----------|-----------------|-----------------|
| Metrics (Prometheus) | 30 days at full resolution, 1 year at downsampled resolution (5m step) | Prometheus with Thanos/Cortex long-term storage (if configured) |
| Logs (Elasticsearch) | 15 days hot storage, 30 days warm storage, 90 days cold/archive | Elasticsearch ILM (Index Lifecycle Management) policy |
| Log index rollover | Daily index rollover when index size exceeds 50 GB | Elasticsearch rollover alias |

### 4.3 Pagination and Result Limits

| Requirement | Specification |
|-------------|---------------|
| Metrics API response | Maximum 11,000 data points per query (Prometheus default limit); backend enforces `step` to stay within this limit |
| Log query page size | Default: 100 entries per page, maximum: 500 per page (configurable via `pageSize` query parameter) |
| Log search result limit | Full-text search returns a maximum of 10,000 matching documents; deeper pagination requires narrower filters |
| Cursor-based pagination | Log queries use Elasticsearch `search_after` for stateless cursor pagination (no session-based scroll contexts) |

### 4.4 Security and Access Control

| Requirement | Specification |
|-------------|---------------|
| Authentication | All API endpoints require a valid Bearer JWT token |
| Authorization | Metrics and Log API endpoints enforce RBAC: Admin and Operator have full access; Viewer has read-only access |
| Data isolation | If multi-tenancy is enabled in a future phase, metrics and logs must be scoped to the user's tenant |
| Audit logging | All log search queries executed by users are recorded in the audit log (ES audit index) for compliance |

### 4.5 Reliability and Availability

| Requirement | Target |
|-------------|--------|
| Metrics API availability | 99.9% uptime (aligned with platform SLA) |
| Log Explorer availability | 99.9% uptime |
| Graceful degradation | If Prometheus is unreachable, the Metrics Explorer shows a "Data source unavailable" message; cached data (if any) is displayed with a stale indicator. Same pattern for Elasticsearch. |

---

## 5. Open Questions

The following questions require resolution before or during Sprint 5 planning. The BA team will drive these to closure with the relevant stakeholders.

| # | Question | Raised By | Target Audience | Impact if Unresolved |
|---|----------|-----------|-----------------|----------------------|
| OQ-1 | **Slow-query threshold configurability:** Should the slow-query threshold (default 500ms) be configurable per service, or is a global default sufficient for Phase 2? Per-service configuration adds a settings UI and a PostgreSQL config entry. | BA Team | Tech Lead, POD 2 | MET-006 acceptance criteria may need revision |
| OQ-2 | **Web Vitals data availability:** Which monitored front-end applications currently have the OTel Browser SDK integrated? If none are instrumented before Sprint 6, MET-005 will have no data to display and testing will require a stub data generator. | BA Team | POD 1 (DevOps), Client Teams | MET-005 cannot be validated without browser telemetry data |
| OQ-3 | **Log search syntax exposure:** Should the Log Explorer expose raw Elasticsearch query syntax to users (AC-3 of LOG-002), or should we abstract it behind a simplified filter builder? Exposing raw syntax provides power users with flexibility but may confuse Viewer-role users. | BA Team | UX Lead, Tech Lead | LOG-002 UI design and backend query handling |
| OQ-4 | **Cross-service trace-level logs:** LOG-004 requires querying logs across all services for a traceId. Should the API be `GET /api/v1/logs?traceId={id}` (service-agnostic) or should the user first select a service? A service-agnostic endpoint requires a cross-service Elasticsearch query. | BA Team | Tech Lead, POD 2 | LOG-004 API contract and backend query design |
| OQ-5 | **Log retention policy confirmation:** The HLD does not specify exact retention periods. Are 15 days hot / 30 days warm / 90 days cold acceptable to the operations team, or do compliance requirements mandate longer retention? | BA Team | Ops Lead, Compliance | Elasticsearch ILM policy configuration, storage cost |
| OQ-6 | **Live tail implementation approach:** Should live tail (LOG-008, MET-010) use polling (simpler, 3-5s delay) or Server-Sent Events / WebSocket (lower latency, higher complexity)? This affects backend architecture and Sprint 7 effort. | BA Team | Tech Lead, POD 2 | LOG-008 and MET-010 story point estimates may change |
| OQ-7 | **Metric downsampling strategy:** For queries spanning more than 7 days, should the backend automatically downsample (e.g., switch to recording rules with pre-aggregated 5m data), or should we query raw data with a larger step? Downsampling improves performance but requires Prometheus recording rules to be defined. | BA Team | Tech Lead, POD 1 | MET-004 resolution strategy and Prometheus configuration |
| OQ-8 | **Log pattern detection algorithm:** MET-007 references "top log message patterns." Should pattern detection use Elasticsearch's built-in categorize_text aggregation, or a custom drain-based algorithm in the backend? The former is simpler but less accurate; the latter provides better pattern quality but adds development effort. | BA Team | Tech Lead, POD 2 | MET-007 story point estimate and Sprint 6 capacity |

---

## 6. Revision History

| Version | Date       | Author               | Changes                        |
|---------|------------|-----------------------|--------------------------------|
| 1.0     | 2026-03-15 | Business Analysis Team | Initial version — Sprint 5 planning ready |
