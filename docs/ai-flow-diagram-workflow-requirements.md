# Requirements Document: AI-Powered Service Flow Diagram & Workflow Conversion

**Document Version:** 1.0
**Date:** 2026-03-26
**Module:** 12 — AI Capabilities (extends Modules 7 & 8)
**Platform:** Systems Insight — Observability Platform
**Status:** Draft
**Author:** Systems Insight Product Team

---

## 1. Executive Summary

This document defines the requirements for two interrelated AI-powered features within the Systems Insight platform:

1. **AI Service Flow Diagram Generator** — Users select a set of UI and backend services; the AI engine analyzes distributed trace data, discovers inter-service correlations, and generates an interactive graphical flow diagram showing the real request paths across those services.

2. **Diagram-to-Workflow Converter** — Users convert a generated flow diagram (or a selected sub-path within it) into a persisted, monitored Workflow definition, enabling continuous business-level observability against the discovered flow.

These features bridge the existing Dependency Metrics module (Module 7), Workflow Configuration/Marker module (Module 8), and AI Capabilities module (Module 12) by using AI to automate what is currently a manual process — understanding service interactions from traces and defining workflows for monitoring.

---

## 2. Business Context & Motivation

### Problem Statement

Today, platform users must:
- Manually inspect individual traces in the Jaeger waterfall view to understand how services interact.
- Mentally piece together multi-service request flows from hundreds of trace spans.
- Manually define Workflow definitions (service + method + path per step) to enable business-level monitoring.

This is time-consuming, error-prone, and does not scale when services number in the dozens or hundreds.

### Value Proposition

| Benefit | Description |
|---------|-------------|
| **Accelerated Root Cause Analysis** | Visualize actual service interaction patterns in seconds instead of hours of trace inspection |
| **Automated Workflow Discovery** | AI discovers real request flows from production data — no manual workflow definition needed |
| **Reduced MTTR** | Operations teams can instantly see how a business transaction flows across services and where failures occur |
| **Living Documentation** | Generated flow diagrams serve as always-up-to-date service interaction documentation |
| **Seamless Monitoring Setup** | One-click conversion from discovered flow to monitored workflow with SLA thresholds |

### Target Users

| Persona | Role | Primary Use |
|---------|------|-------------|
| **Platform Engineer** | Manages service infrastructure | Understand service topology and interaction patterns |
| **SRE / Ops Engineer** | Monitors production health | Quickly set up workflow monitoring for critical business paths |
| **Tech Lead / Architect** | Designs system architecture | Validate actual service interactions match intended architecture |
| **Business Analyst** | Defines business KPIs | Map business transactions to technical service flows |

---

## 3. Feature 1: AI Service Flow Diagram Generator

### 3.1 Overview

The AI Service Flow Diagram Generator allows users to select a set of services (frontend and backend) from the Service Catalog, define a time range, and invoke the AI engine to analyze distributed traces flowing across those services. The AI correlates spans, identifies distinct request flows, calculates aggregate metrics, and renders an interactive graphical flow diagram.

### 3.2 Functional Requirements

#### FR-1.1: Service Selection Interface

| ID | Requirement |
|----|-------------|
| FR-1.1.1 | The system shall provide a multi-select service picker populated from the Service Catalog (`/api/v1/services`) |
| FR-1.1.2 | Services shall be categorized and filterable by type: `UI`, `BACKEND`, `DATABASE`, `CLOUD_COMPONENT` |
| FR-1.1.3 | The user shall be able to select a minimum of 2 and a maximum of 20 services for analysis |
| FR-1.1.4 | The system shall display service health indicators (status, last-seen) alongside each service in the picker |
| FR-1.1.5 | The user shall be able to specify a time range for trace analysis (preset: last 15m, 1h, 6h, 24h, 7d; or custom range) |
| FR-1.1.6 | The system shall allow the user to optionally filter by operation name or HTTP endpoint pattern to narrow the analysis scope |
| FR-1.1.7 | The user shall be able to save frequently used service selections as named presets for reuse |

#### FR-1.2: AI Trace Analysis Engine

| ID | Requirement |
|----|-------------|
| FR-1.2.1 | The AI engine shall query distributed traces from Jaeger/Elasticsearch that involve any of the selected services within the specified time range |
| FR-1.2.2 | The engine shall extract and correlate spans across services using `traceId`, `parentSpanId`, and OTel semantic attributes (`service.name`, `http.method`, `http.route`, `http.status_code`, `peer.service`, `db.system`, `rpc.method`) |
| FR-1.2.3 | The engine shall identify distinct request flow patterns by clustering traces with similar span sequences (service call chains) |
| FR-1.2.4 | For each identified flow pattern, the engine shall compute aggregate metrics: call count, avg/p50/p95/p99 latency, error rate, and throughput |
| FR-1.2.5 | The engine shall detect branching paths (parallel calls, conditional paths) and represent them in the flow model |
| FR-1.2.6 | The engine shall identify database calls, message queue interactions, and external API calls within the flow and include them as nodes |
| FR-1.2.7 | The engine shall rank discovered flow patterns by frequency (most common flows first) |
| FR-1.2.8 | The engine shall support a configurable trace sample limit (default: 1000 traces) to balance analysis depth vs. performance |
| FR-1.2.9 | The engine shall use the AI/ML sidecar (gRPC) for pattern clustering and anomaly detection on discovered flows |
| FR-1.2.10 | The engine shall complete analysis within 30 seconds for up to 1000 traces across 10 services (P95 target) |

#### FR-1.3: Flow Diagram Rendering

| ID | Requirement |
|----|-------------|
| FR-1.3.1 | The system shall render an interactive directed graph (DAG) showing services as nodes and request flows as directed edges |
| FR-1.3.2 | Each node shall display: service name, service type icon (UI/Backend/DB/Queue/External), and health indicator |
| FR-1.3.3 | Each edge shall display: request count, avg latency, error rate, and HTTP method/path |
| FR-1.3.4 | Edges shall be color-coded by health: green (error rate < 1%), yellow (1-5%), red (> 5%) |
| FR-1.3.5 | Edge thickness shall represent relative throughput (thicker = more traffic) |
| FR-1.3.6 | The user shall be able to click on any node to expand it and see its internal operations (API endpoints) |
| FR-1.3.7 | The user shall be able to click on any edge to see detailed metrics: latency histogram, error breakdown, and sample trace IDs |
| FR-1.3.8 | The diagram shall support zoom, pan, and fit-to-screen controls |
| FR-1.3.9 | The system shall support multiple layout algorithms: hierarchical (top-down), force-directed, and left-to-right |
| FR-1.3.10 | The user shall be able to highlight a specific flow pattern (from the ranked list) to isolate it in the diagram |
| FR-1.3.11 | The diagram shall support full-screen mode |
| FR-1.3.12 | The user shall be able to export the diagram as PNG or SVG |

#### FR-1.4: Flow Pattern Detail Panel

| ID | Requirement |
|----|-------------|
| FR-1.4.1 | When a flow pattern is selected, a side panel shall display the ordered step sequence: Step # -> Service -> Method -> Path -> Avg Latency |
| FR-1.4.2 | The panel shall show a latency breakdown stacked bar chart (contribution of each step to total latency) |
| FR-1.4.3 | The panel shall show the top 5 slowest trace instances for the selected flow pattern, with links to the Jaeger waterfall view |
| FR-1.4.4 | The panel shall identify the bottleneck step (highest latency contribution) and highlight it |
| FR-1.4.5 | The panel shall show error distribution per step |

### 3.3 User Stories

#### Epic: AI-Powered Service Flow Diagram Generation

---

**US-1.1: Select Services for Flow Analysis**

> As a **Platform Engineer**, I want to **select a set of UI and backend services from the Service Catalog** so that **I can scope the AI analysis to the services I'm interested in**.

**Acceptance Criteria:**
1. Given the Service Catalog has registered services, when I open the Flow Diagram Generator page, then I see a searchable multi-select picker with all active services grouped by type (UI, Backend, Database, Cloud).
2. Given I have selected fewer than 2 services, when I click "Analyze", then the button is disabled with a tooltip "Select at least 2 services".
3. Given I have selected more than 20 services, when I try to add another, then the system shows a warning "Maximum 20 services allowed" and prevents the addition.
4. Given I have selected services, when I view the picker, then each service shows its status badge (healthy/degraded/down) and last-seen timestamp.

**Story Points:** 5
**Sprint:** S15 or S16
**Pod:** POD 3 (Frontend)

---

**US-1.2: Configure Analysis Parameters**

> As an **SRE**, I want to **specify the time range and optional filters for trace analysis** so that **the AI analyzes the most relevant data for my investigation**.

**Acceptance Criteria:**
1. Given I have selected services, when I configure the analysis, then I can choose a preset time range (15m, 1h, 6h, 24h, 7d) or specify a custom date-time range.
2. Given I specify a custom range exceeding 7 days, when I click "Analyze", then the system warns "Large time ranges may take longer to analyze" but allows proceeding.
3. Given I want to narrow the analysis, when I open advanced filters, then I can optionally filter by operation name pattern (e.g., `POST /api/v1/orders/*`).
4. Given I want to control analysis depth, when I open advanced settings, then I can adjust the trace sample limit (100–5000, default 1000).

**Story Points:** 3
**Sprint:** S15 or S16
**Pod:** POD 3 (Frontend)

---

**US-1.3: AI Analyzes Traces and Discovers Flow Patterns**

> As a **Platform Engineer**, I want the **AI engine to analyze distributed traces across my selected services and identify distinct request flow patterns** so that **I can understand how requests actually flow through my system without manually inspecting traces**.

**Acceptance Criteria:**
1. Given I have selected services and clicked "Analyze", when the AI engine runs, then it queries traces from Jaeger involving the selected services within the time range.
2. Given traces are retrieved, when the engine processes them, then it extracts span sequences, correlates parent-child relationships, and clusters traces into distinct flow patterns.
3. Given flow patterns are identified, when processing completes, then each pattern includes: ordered step list (service + method + path), call count, avg/p50/p95/p99 latency, and error rate.
4. Given the analysis completes, when results are returned, then flow patterns are ranked by frequency (most common first).
5. Given up to 1000 traces across 10 services, when the analysis runs, then it completes within 30 seconds (P95).
6. Given the analysis is running, when I view the UI, then I see a progress indicator with estimated time remaining.
7. Given an analysis fails (e.g., no traces found, timeout), when the error occurs, then a descriptive error message is shown with suggestions (e.g., "No traces found — try expanding the time range").

**Story Points:** 13
**Sprint:** S15 or S16
**Pod:** POD 2 (Backend)

---

**US-1.4: View Interactive Flow Diagram**

> As a **Tech Lead**, I want to **view an interactive graphical flow diagram showing how requests flow across my selected services** so that **I can validate the actual service interaction patterns match our intended architecture**.

**Acceptance Criteria:**
1. Given the AI analysis is complete, when the results load, then I see a directed graph with services as nodes and request flows as directed edges.
2. Given the diagram is rendered, when I look at nodes, then each shows the service name, type icon (UI/Backend/DB/Queue), and a health dot (green/yellow/red).
3. Given the diagram is rendered, when I look at edges, then each shows call count, avg latency, and error rate, with color-coding (green < 1% errors, yellow 1-5%, red > 5%).
4. Given the diagram is rendered, when I look at edge thickness, then thicker edges represent higher throughput relative to other edges.
5. Given the diagram is rendered, when I use mouse/trackpad, then I can zoom in/out, pan, and use a "fit to screen" button.
6. Given multiple flow patterns exist, when I select a specific pattern from the ranked list, then only the edges and nodes involved in that pattern are highlighted.

**Story Points:** 8
**Sprint:** S15 or S16
**Pod:** POD 3 (Frontend)

---

**US-1.5: Inspect Node and Edge Details**

> As an **SRE**, I want to **click on nodes and edges in the flow diagram to see detailed metrics** so that **I can drill down into specific service interactions for troubleshooting**.

**Acceptance Criteria:**
1. Given the diagram is rendered, when I click a service node, then a popover shows: service name, type, total inbound/outbound call counts, average latency, error rate, and a list of its API operations visible in this flow.
2. Given the diagram is rendered, when I click an edge, then a detail panel opens showing: latency histogram (distribution), error breakdown by status code, HTTP method + path, and up to 10 sample trace IDs as clickable links to the trace detail view.
3. Given I click a sample trace link, when the link opens, then I am navigated to the existing Traces deep-dive page (Module 5) with that trace pre-loaded.

**Story Points:** 5
**Sprint:** S15 or S16
**Pod:** POD 3 (Frontend)

---

**US-1.6: View Flow Pattern Step Breakdown**

> As a **Business Analyst**, I want to **see the step-by-step breakdown of a discovered flow pattern with latency contribution per step** so that **I can identify which service is the bottleneck in a business transaction**.

**Acceptance Criteria:**
1. Given a flow pattern is selected, when the detail panel opens, then I see an ordered table: Step # | Service | Method | Path | Avg Latency | Error Rate.
2. Given the detail panel is open, when I view the latency breakdown, then a stacked bar chart shows each step's latency contribution to the total flow duration.
3. Given the detail panel is open, when I look at the bottleneck indicator, then the step with the highest latency contribution is highlighted with a "Bottleneck" badge.
4. Given the detail panel is open, when I view sample traces, then the top 5 slowest trace instances for this pattern are listed with their total duration and a link to the Jaeger waterfall.

**Story Points:** 5
**Sprint:** S15 or S16
**Pod:** POD 3 (Frontend)

---

**US-1.7: Export Flow Diagram**

> As a **Tech Lead**, I want to **export the generated flow diagram as an image** so that **I can include it in architecture review documents and presentations**.

**Acceptance Criteria:**
1. Given a flow diagram is rendered, when I click the "Export" button, then I can choose between PNG and SVG formats.
2. Given I choose PNG, when the export completes, then the image includes the full diagram at high resolution with a legend showing color/thickness semantics.
3. Given I choose SVG, when the export completes, then the SVG is scalable and preserves all node/edge labels.

**Story Points:** 3
**Sprint:** S15 or S16
**Pod:** POD 3 (Frontend)

---

**US-1.8: Save Service Selection Presets**

> As an **SRE**, I want to **save my frequently used service selections as named presets** so that **I can quickly re-run analysis on the same service group without re-selecting each time**.

**Acceptance Criteria:**
1. Given I have selected services, when I click "Save as Preset", then I can enter a name and save the current service selection + default time range.
2. Given I have saved presets, when I open the Flow Diagram Generator, then I see a "Load Preset" dropdown listing my saved presets.
3. Given I load a preset, when it applies, then all services from the preset are pre-selected in the picker.
4. Given I want to manage presets, when I open preset management, then I can rename or delete existing presets.

**Story Points:** 3
**Sprint:** S15 or S16
**Pod:** POD 3 (Frontend)

---

### 3.4 API Specification

#### `POST /api/v1/ai/flow-analysis`

**Description:** Initiate AI flow analysis for selected services.

**Request Body:**
```json
{
  "serviceIds": ["uuid-1", "uuid-2", "uuid-3"],
  "timeRange": {
    "start": "2026-03-25T00:00:00Z",
    "end": "2026-03-26T00:00:00Z"
  },
  "operationFilter": "POST /api/v1/orders/*",
  "traceSampleLimit": 1000,
  "includeDbCalls": true,
  "includeExternalCalls": true
}
```

**Response Body (202 Accepted — async job):**
```json
{
  "analysisId": "uuid",
  "status": "IN_PROGRESS",
  "estimatedDurationMs": 15000,
  "pollUrl": "/api/v1/ai/flow-analysis/uuid"
}
```

#### `GET /api/v1/ai/flow-analysis/{analysisId}`

**Description:** Poll for analysis status and results.

**Response Body (200 OK — completed):**
```json
{
  "analysisId": "uuid",
  "status": "COMPLETED",
  "completedAt": "2026-03-26T10:05:30Z",
  "tracesAnalyzed": 847,
  "flowPatterns": [
    {
      "patternId": "uuid",
      "name": "Order Placement Flow",
      "frequency": 312,
      "avgLatencyMs": 450,
      "p95LatencyMs": 890,
      "p99LatencyMs": 1200,
      "errorRate": 0.02,
      "steps": [
        {
          "order": 1,
          "serviceName": "pizzahut-ui",
          "serviceType": "UI",
          "method": "POST",
          "path": "/api/v1/orders",
          "avgLatencyMs": 15,
          "errorRate": 0.0
        },
        {
          "order": 2,
          "serviceName": "order-service",
          "serviceType": "BACKEND",
          "method": "POST",
          "path": "/api/v1/orders",
          "avgLatencyMs": 120,
          "errorRate": 0.01
        },
        {
          "order": 3,
          "serviceName": "order-service",
          "serviceType": "DATABASE",
          "method": "INSERT",
          "path": "pizzahut.orders",
          "avgLatencyMs": 25,
          "errorRate": 0.0
        },
        {
          "order": 4,
          "serviceName": "notification-service",
          "serviceType": "BACKEND",
          "method": "POST",
          "path": "/api/v1/notifications/email",
          "avgLatencyMs": 290,
          "errorRate": 0.05
        }
      ],
      "edges": [
        {
          "source": "pizzahut-ui",
          "target": "order-service",
          "callCount": 312,
          "avgLatencyMs": 120,
          "errorRate": 0.01,
          "httpMethod": "POST",
          "httpPath": "/api/v1/orders"
        }
      ],
      "sampleTraceIds": ["abc123", "def456", "ghi789"]
    }
  ],
  "graph": {
    "nodes": [
      {
        "id": "order-service",
        "label": "order-service",
        "type": "BACKEND",
        "metrics": {
          "totalCalls": 847,
          "avgLatencyMs": 120,
          "errorRate": 0.01
        }
      }
    ],
    "edges": [
      {
        "source": "pizzahut-ui",
        "target": "order-service",
        "callCount": 312,
        "avgLatencyMs": 120,
        "errorRate": 0.01
      }
    ]
  }
}
```

#### `GET /api/v1/ai/flow-analysis/{analysisId}/patterns/{patternId}/traces`

**Description:** Get sample traces for a specific flow pattern.

**Response:** List of trace summaries with links to trace detail view.

#### `POST /api/v1/ai/flow-analysis/presets`

**Description:** Save a service selection preset.

**Request Body:**
```json
{
  "name": "PizzaHut Order Flow",
  "serviceIds": ["uuid-1", "uuid-2", "uuid-3"],
  "defaultTimeRangeMinutes": 60
}
```

#### `GET /api/v1/ai/flow-analysis/presets`

**Description:** List saved presets for the current user.

#### `DELETE /api/v1/ai/flow-analysis/presets/{presetId}`

**Description:** Delete a saved preset.

---

## 4. Feature 2: Diagram-to-Workflow Converter

### 4.1 Overview

The Diagram-to-Workflow Converter allows users to take a generated flow diagram (or a selected sub-path within it) and convert it into a monitored Workflow definition in the Workflow Configuration module (Module 8). This bridges AI-driven discovery with operational monitoring — turning observed behavior into a tracked, alertable business workflow.

### 4.2 Functional Requirements

#### FR-2.1: Flow-to-Workflow Conversion

| ID | Requirement |
|----|-------------|
| FR-2.1.1 | The system shall provide a "Convert to Workflow" action on each discovered flow pattern in the diagram view |
| FR-2.1.2 | The system shall also allow the user to manually select a sub-path (subset of nodes/edges) in the diagram and convert that selection to a workflow |
| FR-2.1.3 | When conversion is initiated, the system shall pre-populate a Workflow creation form with: workflow name (auto-generated from pattern), description, and ordered steps extracted from the flow pattern |
| FR-2.1.4 | Each auto-populated workflow step shall include: step order, service name, HTTP method, path pattern, and a label (derived from service + operation) |
| FR-2.1.5 | The user shall be able to edit all pre-populated fields before saving: rename steps, reorder, add/remove steps, adjust path patterns (e.g., parameterize path segments) |
| FR-2.1.6 | The system shall auto-suggest SLA thresholds based on the analyzed metrics: max duration (p95 of total flow latency), max error rate (observed error rate + buffer) |
| FR-2.1.7 | The user shall be able to accept, modify, or decline the suggested SLA thresholds |
| FR-2.1.8 | Upon saving, the system shall create a Workflow entity and its steps via the existing Workflow API (`POST /api/v1/workflows`) |
| FR-2.1.9 | The system shall store a reference linking the workflow back to the originating flow analysis for audit purposes |

#### FR-2.2: Workflow Monitoring Setup

| ID | Requirement |
|----|-------------|
| FR-2.2.1 | After workflow creation, the system shall prompt the user to enable monitoring immediately or defer |
| FR-2.2.2 | When monitoring is enabled, the Trace Correlation Engine (Module 8) shall begin matching incoming traces against the new workflow definition |
| FR-2.2.3 | The system shall display a confirmation with a direct link to the Workflow Dashboard for the newly created workflow |
| FR-2.2.4 | The system shall allow the user to configure alert channels (Email, SMS, Teams) for workflow SLA breaches during the conversion flow |

#### FR-2.3: Workflow Diff and Update

| ID | Requirement |
|----|-------------|
| FR-2.3.1 | If the user re-runs flow analysis for services that already have a saved workflow, the system shall detect overlap and show a diff between the existing workflow and the newly discovered flow |
| FR-2.3.2 | The diff shall highlight: new steps not in the existing workflow, steps that no longer appear in traces, and steps with changed latency/error characteristics |
| FR-2.3.3 | The user shall be able to choose: update the existing workflow with new steps, create a new workflow version, or dismiss the diff |

### 4.3 User Stories

#### Epic: Diagram-to-Workflow Conversion & Monitoring

---

**US-2.1: Convert Flow Pattern to Workflow**

> As an **SRE**, I want to **convert a discovered flow pattern into a monitored workflow with one click** so that **I can set up business-level monitoring without manually defining each workflow step**.

**Acceptance Criteria:**
1. Given a flow diagram is displayed with discovered patterns, when I click "Convert to Workflow" on a flow pattern, then a Workflow creation form opens pre-populated with the pattern's steps.
2. Given the form is pre-populated, when I review the steps, then each step shows: order number, service name, HTTP method, path pattern, and an auto-generated label.
3. Given the form is pre-populated, when I review the workflow name, then it is auto-generated from the pattern (e.g., "pizzahut-ui -> order-service -> notification-service Flow").
4. Given I make no edits, when I click "Save Workflow", then the workflow and its steps are created via `POST /api/v1/workflows` and I see a success confirmation.
5. Given the workflow is created, when I view the confirmation, then it includes a direct link to the Workflow Dashboard for this workflow.

**Story Points:** 8
**Sprint:** S16 or S17
**Pod:** POD 3 (Frontend) + POD 2 (Backend)

---

**US-2.2: Edit Pre-Populated Workflow Before Saving**

> As a **Platform Engineer**, I want to **edit the auto-generated workflow steps before saving** so that **I can fine-tune the workflow to match exactly the business process I want to monitor**.

**Acceptance Criteria:**
1. Given the pre-populated Workflow form is open, when I click on a step's path pattern, then I can edit it (e.g., change `/api/v1/orders/abc123` to `/api/v1/orders/{orderId}`).
2. Given the form is open, when I click on a step label, then I can rename it to a business-friendly name (e.g., "Create Order" instead of "POST /api/v1/orders").
3. Given the form is open, when I drag a step, then I can reorder steps within the workflow.
4. Given the form is open, when I click "Add Step", then I can manually add a step that was not in the discovered pattern (with service picker, method, and path fields).
5. Given the form is open, when I click the delete icon on a step, then the step is removed from the workflow with a confirmation prompt.

**Story Points:** 5
**Sprint:** S16 or S17
**Pod:** POD 3 (Frontend)

---

**US-2.3: AI-Suggested SLA Thresholds**

> As an **SRE**, I want the **system to auto-suggest SLA thresholds based on the analyzed trace metrics** so that **I start with realistic thresholds grounded in actual production data**.

**Acceptance Criteria:**
1. Given a flow pattern is being converted to a workflow, when the SLA section loads, then the `max_duration_ms` field is pre-filled with the P95 latency of the analyzed flow pattern (rounded up to the nearest 100ms).
2. Given the SLA section loads, when I view the `max_error_rate_pct` field, then it is pre-filled with: `observed error rate + 1%` (capped at 10%).
3. Given the SLA fields are pre-filled, when I hover over the suggested values, then a tooltip shows: "Suggested based on [N] traces analyzed from [start] to [end]. P50: Xms, P95: Yms, P99: Zms, Error Rate: N%".
4. Given I disagree with the suggestions, when I edit the SLA fields, then I can enter custom values.
5. Given I do not want SLA monitoring initially, when I toggle SLA off, then the workflow is saved without SLA thresholds.

**Story Points:** 5
**Sprint:** S16 or S17
**Pod:** POD 2 (Backend) + POD 3 (Frontend)

---

**US-2.4: Select Sub-Path for Workflow Conversion**

> As a **Tech Lead**, I want to **select a specific sub-path within the flow diagram and convert only that portion to a workflow** so that **I can create focused workflows for specific segments of a larger service flow**.

**Acceptance Criteria:**
1. Given a flow diagram is displayed, when I enter "selection mode" (via a toolbar toggle), then I can click on a sequence of connected nodes/edges to define a sub-path.
2. Given I have selected a sub-path (minimum 2 connected nodes), when I click "Convert Selection to Workflow", then the Workflow form is pre-populated with only the steps from my selection.
3. Given I select nodes that are not connected, when I try to convert, then the system shows "Selected services must form a connected path" and prevents conversion.
4. Given I am in selection mode, when I click "Clear Selection", then all selections are removed.

**Story Points:** 5
**Sprint:** S16 or S17
**Pod:** POD 3 (Frontend)

---

**US-2.5: Enable Workflow Monitoring After Creation**

> As an **SRE**, I want to **immediately enable trace correlation monitoring after creating a workflow from a flow diagram** so that **the system starts tracking this business flow in real-time without a separate setup step**.

**Acceptance Criteria:**
1. Given a workflow has been saved from a flow diagram conversion, when the success dialog appears, then it includes a toggle: "Enable monitoring now" (default: on).
2. Given I enable monitoring, when the toggle is activated, then the Trace Correlation Engine begins matching incoming traces against the new workflow definition.
3. Given monitoring is enabled, when I view the success dialog, then it shows: "Monitoring active. View dashboard" with a link to `/workflows/{id}/dashboard`.
4. Given I want to configure alerts, when I click "Configure Alerts" in the success dialog, then I can select alert channels (Email, SMS, Teams) for SLA breach notifications.
5. Given I defer monitoring, when I toggle it off, then the workflow is saved with `enabled: false` and I can enable it later from the Workflow Dashboard.

**Story Points:** 3
**Sprint:** S16 or S17
**Pod:** POD 2 (Backend) + POD 3 (Frontend)

---

**US-2.6: Detect Workflow Drift via Re-Analysis**

> As a **Platform Engineer**, I want the **system to detect when a re-run of flow analysis shows differences from an existing saved workflow** so that **I can keep my monitored workflows aligned with actual production behavior**.

**Acceptance Criteria:**
1. Given I run flow analysis for services that have an existing saved workflow, when the analysis completes, then the system compares discovered patterns against existing workflow definitions.
2. Given overlap is detected, when I view the results, then a "Workflow Drift Detected" badge appears next to the matching pattern.
3. Given I click the drift badge, when the diff panel opens, then I see a side-by-side comparison: existing workflow steps vs. newly discovered steps, with added/removed/changed steps highlighted.
4. Given the diff shows changes, when I review, then I can choose: "Update Existing Workflow" (modifies steps in-place), "Create New Version" (creates a new workflow), or "Dismiss" (ignore the diff).
5. Given I choose "Update Existing Workflow", when I confirm, then the workflow steps are updated and the Trace Correlation Engine uses the new definition immediately.

**Story Points:** 8
**Sprint:** S16 or S17
**Pod:** POD 2 (Backend) + POD 3 (Frontend)

---

**US-2.7: Audit Trail for AI-Generated Workflows**

> As a **Tech Lead**, I want **workflows created from AI flow analysis to retain a link back to the originating analysis** so that **I can understand how and when a workflow was discovered**.

**Acceptance Criteria:**
1. Given a workflow is created from a flow diagram, when it is saved, then the workflow entity stores a reference to the `analysisId` and `patternId` that generated it.
2. Given I view a workflow in the Workflow Dashboard, when I look at the metadata section, then I see: "Generated from AI Flow Analysis on [date], based on [N] traces".
3. Given I click the analysis reference link, when it opens, then I am navigated to the cached results of the original flow analysis (if still available) or shown a "Re-run analysis" prompt.

**Story Points:** 3
**Sprint:** S16 or S17
**Pod:** POD 2 (Backend) + POD 3 (Frontend)

---

### 4.4 API Specification

#### `POST /api/v1/ai/flow-analysis/{analysisId}/patterns/{patternId}/convert-to-workflow`

**Description:** Convert a discovered flow pattern to a workflow definition.

**Request Body:**
```json
{
  "workflowName": "Order Placement Flow",
  "description": "End-to-end order placement from UI to notification",
  "ownerTeam": "order-team",
  "sla": {
    "maxDurationMs": 1000,
    "maxErrorRatePct": 3.0
  },
  "steps": [
    {
      "stepOrder": 1,
      "serviceName": "pizzahut-ui",
      "httpMethod": "POST",
      "pathPattern": "/api/v1/orders",
      "label": "Submit Order"
    },
    {
      "stepOrder": 2,
      "serviceName": "order-service",
      "httpMethod": "POST",
      "pathPattern": "/api/v1/orders",
      "label": "Create Order"
    },
    {
      "stepOrder": 3,
      "serviceName": "notification-service",
      "httpMethod": "POST",
      "pathPattern": "/api/v1/notifications/email",
      "label": "Send Confirmation Email"
    }
  ],
  "enableMonitoring": true,
  "alertChannelIds": ["uuid-email", "uuid-teams"]
}
```

**Response Body (201 Created):**
```json
{
  "workflowId": "uuid",
  "name": "Order Placement Flow",
  "stepsCreated": 3,
  "monitoringEnabled": true,
  "sla": {
    "maxDurationMs": 1000,
    "maxErrorRatePct": 3.0
  },
  "sourceAnalysisId": "uuid",
  "sourcePatternId": "uuid",
  "dashboardUrl": "/workflows/uuid/dashboard",
  "createdAt": "2026-03-26T10:10:00Z"
}
```

#### `GET /api/v1/ai/flow-analysis/{analysisId}/patterns/{patternId}/sla-suggestions`

**Description:** Get AI-suggested SLA thresholds for a flow pattern.

**Response Body:**
```json
{
  "suggestedMaxDurationMs": 1000,
  "suggestedMaxErrorRatePct": 3.0,
  "basedOn": {
    "tracesAnalyzed": 312,
    "timeRange": {
      "start": "2026-03-25T00:00:00Z",
      "end": "2026-03-26T00:00:00Z"
    },
    "latencyStats": {
      "p50Ms": 420,
      "p95Ms": 890,
      "p99Ms": 1200,
      "avgMs": 450
    },
    "observedErrorRate": 0.02
  }
}
```

#### `POST /api/v1/ai/flow-analysis/{analysisId}/drift-check`

**Description:** Compare discovered patterns against existing workflows.

**Request Body:**
```json
{
  "workflowIds": ["uuid-1", "uuid-2"]
}
```

**Response Body:**
```json
{
  "drifts": [
    {
      "workflowId": "uuid-1",
      "workflowName": "Order Placement Flow",
      "matchedPatternId": "uuid-pattern",
      "changes": {
        "addedSteps": [
          {
            "serviceName": "payment-service",
            "method": "POST",
            "path": "/api/v1/payments"
          }
        ],
        "removedSteps": [],
        "modifiedSteps": [
          {
            "stepOrder": 2,
            "field": "avgLatencyMs",
            "previousValue": 120,
            "currentValue": 340,
            "changePercent": 183
          }
        ]
      },
      "severity": "WARNING"
    }
  ]
}
```

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | **Performance** | Flow analysis shall complete within 30s for 1000 traces across 10 services (P95) |
| NFR-2 | **Performance** | Diagram rendering shall achieve 60fps for graphs with up to 50 nodes and 100 edges |
| NFR-3 | **Performance** | Workflow conversion (save) shall complete within 2 seconds |
| NFR-4 | **Scalability** | Support concurrent flow analyses for up to 10 users simultaneously |
| NFR-5 | **Availability** | AI analysis failures shall not affect core platform functionality (graceful degradation) |
| NFR-6 | **Security** | All API endpoints follow existing Bearer JWT auth and RBAC patterns |
| NFR-7 | **Security** | Flow analysis results are scoped to the user's service access permissions |
| NFR-8 | **Usability** | The service selector, diagram, and workflow form shall be fully keyboard-accessible (WCAG 2.1 AA) |
| NFR-9 | **Data Retention** | Completed flow analysis results shall be cached for 24 hours; expired results are purged |
| NFR-10 | **Observability** | All AI API calls shall emit OTel traces and metrics for self-monitoring |
| NFR-11 | **Compatibility** | Diagram rendering shall work on Chrome 110+, Firefox 110+, Edge 110+, Safari 16+ |
| NFR-12 | **API** | All new endpoints follow `/api/v1/` convention with OpenAPI 3.0 spec |

---

## 6. Data Model Extensions

### 6.1 New Tables

```sql
-- Stores flow analysis job metadata
CREATE TABLE flow_analyses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS'
                        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
    service_ids         UUID[] NOT NULL,
    time_range_start    TIMESTAMPTZ NOT NULL,
    time_range_end      TIMESTAMPTZ NOT NULL,
    operation_filter    VARCHAR(500),
    trace_sample_limit  INT NOT NULL DEFAULT 1000,
    traces_analyzed     INT,
    completed_at        TIMESTAMPTZ,
    error_message       VARCHAR(1000),
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores discovered flow patterns for an analysis
CREATE TABLE flow_patterns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id         UUID NOT NULL REFERENCES flow_analyses(id) ON DELETE CASCADE,
    name                VARCHAR(255),
    frequency           INT NOT NULL DEFAULT 0,
    avg_latency_ms      DOUBLE PRECISION,
    p50_latency_ms      DOUBLE PRECISION,
    p95_latency_ms      DOUBLE PRECISION,
    p99_latency_ms      DOUBLE PRECISION,
    error_rate          DOUBLE PRECISION DEFAULT 0,
    sample_trace_ids    VARCHAR(64)[] DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores ordered steps within a flow pattern
CREATE TABLE flow_pattern_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id          UUID NOT NULL REFERENCES flow_patterns(id) ON DELETE CASCADE,
    step_order          INT NOT NULL,
    service_name        VARCHAR(255) NOT NULL,
    service_type        VARCHAR(50) NOT NULL
                        CHECK (service_type IN ('UI', 'BACKEND', 'DATABASE', 'CLOUD_COMPONENT', 'QUEUE', 'EXTERNAL')),
    http_method         VARCHAR(10),
    path_pattern        VARCHAR(500),
    avg_latency_ms      DOUBLE PRECISION,
    error_rate          DOUBLE PRECISION DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(pattern_id, step_order)
);

-- Stores graph edges for visualization
CREATE TABLE flow_pattern_edges (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id          UUID NOT NULL REFERENCES flow_patterns(id) ON DELETE CASCADE,
    source_service      VARCHAR(255) NOT NULL,
    target_service      VARCHAR(255) NOT NULL,
    call_count          INT NOT NULL DEFAULT 0,
    avg_latency_ms      DOUBLE PRECISION,
    error_rate          DOUBLE PRECISION DEFAULT 0,
    http_method         VARCHAR(10),
    http_path           VARCHAR(500),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stores user's saved service selection presets
CREATE TABLE flow_analysis_presets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    name                VARCHAR(255) NOT NULL,
    service_ids         UUID[] NOT NULL,
    default_time_range_minutes INT DEFAULT 60,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, name)
);
```

### 6.2 Workflow Table Extension

```sql
-- Add columns to existing workflows table for AI provenance tracking
ALTER TABLE workflows ADD COLUMN source_analysis_id UUID REFERENCES flow_analyses(id);
ALTER TABLE workflows ADD COLUMN source_pattern_id  UUID REFERENCES flow_patterns(id);
ALTER TABLE workflows ADD COLUMN generation_method   VARCHAR(20) DEFAULT 'MANUAL'
    CHECK (generation_method IN ('MANUAL', 'AI_GENERATED', 'AI_UPDATED'));
```

---

## 7. UI Wireframe Summary

### Page: AI Flow Diagram Generator (`/flow-analysis`)

```
+-------------------------------------------------------------------+
|  [Service Selector]                     [Time Range: Last 1h v]   |
|  +---------------------------------------------+                  |
|  | Search services...              [Load Preset]|  [Advanced >>>] |
|  | [x] pizzahut-ui         (UI)     healthy     |                  |
|  | [x] order-service       (Backend) healthy    |  Trace Limit:   |
|  | [x] notification-svc    (Backend) healthy    |  [1000    ]     |
|  | [ ] payment-service     (Backend) degraded   |                  |
|  +---------------------------------------------+                  |
|  [3 services selected]        [Save Preset] [Analyze >>>>>]       |
+-------------------------------------------------------------------+
|                                                                    |
|  +--Flow Diagram (D3)--------------------------------------+      |
|  |                                                          |      |
|  |   [pizzahut-ui] ---POST /orders---> [order-service]     |      |
|  |        (UI)          312 calls          (Backend)        |      |
|  |                      120ms avg     /                     |      |
|  |                      1% err       /                      |      |
|  |                                  v                       |      |
|  |                        [PostgreSQL]   [notification-svc] |      |
|  |                          (DB)              (Backend)     |      |
|  |                                                          |      |
|  +--[Zoom +/-] [Fit] [Layout v] [Fullscreen] [Export v]----+      |
|                                                                    |
|  +--Flow Patterns (ranked)--+  +--Pattern Detail Panel--------+   |
|  | 1. Order Placement (312) |  | Steps:                       |   |
|  |    450ms avg, 2% err  [>]|  | 1. pizzahut-ui POST /orders  |   |
|  | 2. Order Status Check(98)|  | 2. order-service POST /orders|   |
|  |    80ms avg, 0% err      |  | 3. notification POST /email  |   |
|  | 3. Menu Browse (445)     |  |                               |   |
|  |    35ms avg, 0% err      |  | [Latency Stacked Bar Chart]  |   |
|  +---------------------------+  | Bottleneck: notification-svc |   |
|                                 |                               |   |
|                                 | [Convert to Workflow >>>>]    |   |
|                                 +-------------------------------+   |
+-------------------------------------------------------------------+
```

### Dialog: Convert to Workflow

```
+-----------------------------------------------------------+
|  Convert Flow Pattern to Monitored Workflow                |
+-----------------------------------------------------------+
|  Name:  [Order Placement Flow                   ]         |
|  Desc:  [Auto-discovered from 312 traces         ]        |
|  Team:  [order-team                v]                      |
+-----------------------------------------------------------+
|  Steps:                                                    |
|  [=] 1. pizzahut-ui     POST  /api/v1/orders  [Submit]  x|
|  [=] 2. order-service   POST  /api/v1/orders  [Create]  x|
|  [=] 3. notification    POST  /api/v1/.../email [Email]  x|
|  [+ Add Step]                                              |
+-----------------------------------------------------------+
|  SLA Thresholds (AI-Suggested):                            |
|  Max Duration:    [1000   ] ms  (Based on P95: 890ms)     |
|  Max Error Rate:  [3.0    ] %   (Observed: 2.0%)          |
|  [i] Suggested based on 312 traces from last 24h          |
+-----------------------------------------------------------+
|  Monitoring:                                               |
|  [x] Enable monitoring immediately                         |
|  Alert Channels: [x] Email  [ ] SMS  [x] Teams            |
+-----------------------------------------------------------+
|                          [Cancel]  [Save & Monitor >>>>]   |
+-----------------------------------------------------------+
```

---

## 8. Dependencies

| Dependency | Module | Status | Notes |
|------------|--------|--------|-------|
| Service Catalog API | Module 2 (APM) | Available | Provides service list for picker |
| Jaeger Query API | Module 5 (Traces) | Available | Source of trace data for analysis |
| Dependency Service | Module 7 | Available | Reuse dependency extraction logic |
| Workflow CRUD API | Module 8 | Available | Target for workflow creation |
| Trace Correlation Engine | Module 8 | Available | Monitors created workflows |
| AI/ML Sidecar (gRPC) | Module 12 | In Progress (S15) | Pattern clustering and anomaly detection |
| D3.js / React Flow | Frontend | Available | Dependency Map already uses D3 |
| Alert Channel API | Module 6 (SLA) | Available | For workflow SLA alerting |

---

## 9. Story Point Summary

| Story | Title | Points | Pod |
|-------|-------|--------|-----|
| **Feature 1: AI Flow Diagram Generator** | | **45** | |
| US-1.1 | Select Services for Flow Analysis | 5 | POD 3 |
| US-1.2 | Configure Analysis Parameters | 3 | POD 3 |
| US-1.3 | AI Analyzes Traces and Discovers Flow Patterns | 13 | POD 2 |
| US-1.4 | View Interactive Flow Diagram | 8 | POD 3 |
| US-1.5 | Inspect Node and Edge Details | 5 | POD 3 |
| US-1.6 | View Flow Pattern Step Breakdown | 5 | POD 3 |
| US-1.7 | Export Flow Diagram | 3 | POD 3 |
| US-1.8 | Save Service Selection Presets | 3 | POD 3 |
| **Feature 2: Diagram-to-Workflow Converter** | | **37** | |
| US-2.1 | Convert Flow Pattern to Workflow | 8 | POD 2+3 |
| US-2.2 | Edit Pre-Populated Workflow Before Saving | 5 | POD 3 |
| US-2.3 | AI-Suggested SLA Thresholds | 5 | POD 2+3 |
| US-2.4 | Select Sub-Path for Workflow Conversion | 5 | POD 3 |
| US-2.5 | Enable Workflow Monitoring After Creation | 3 | POD 2+3 |
| US-2.6 | Detect Workflow Drift via Re-Analysis | 8 | POD 2+3 |
| US-2.7 | Audit Trail for AI-Generated Workflows | 3 | POD 2+3 |
| **TOTAL** | | **82** | |

**Estimated Sprint Allocation:** 2 sprints (S15–S16 or S16–S17), aligned with Phase 4 AI Capabilities timeline.

---

## 10. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Trace volume too high for real-time analysis | Slow analysis, timeouts | Medium | Configurable sample limit; async job with polling; progressive loading |
| Sparse trace data yields incomplete flows | Inaccurate diagrams | Medium | Warn users when trace coverage is low; suggest increasing time range |
| AI clustering produces too many/few patterns | Poor UX, irrelevant results | Medium | Tunable clustering sensitivity; allow user to merge/split patterns |
| Workflow drift detection false positives | Alert fatigue | Low | Configurable drift threshold; require manual confirmation before updates |
| D3 rendering performance with large graphs | UI lag | Low | Limit to 20 services / 50 nodes; virtualize off-screen nodes |

---

## 11. Definition of Done

Per project standards:
- >= 80% unit test coverage for new backend services
- Integration tests for flow analysis engine with sample trace data
- Component tests for React diagram and workflow form components
- Peer review + TL approval for architectural changes (new tables, new AI APIs)
- OpenAPI 3.0 spec updated for all new endpoints
- Deployed to Dev environment
- BA acceptance of all user stories
- API P95 < 200ms (excluding async analysis which has its own 30s target)
- Accessibility audit (keyboard navigation, screen reader labels) for new UI components
