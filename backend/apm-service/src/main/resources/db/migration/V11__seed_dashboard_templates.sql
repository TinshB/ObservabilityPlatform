-- =============================================================================
-- V11: Seed 4 predefined dashboard templates (US 13.4)
-- UUID prefix: d0000000-0000-0000-0000-00000000000N (dashboards)
-- Owner:       c0000000-0000-0000-0000-000000000001 (admin from V3)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Service Health
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO dashboards (id, name, description, owner_id, is_template, tags, layout)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'Service Health',
    'High-level service health overview: request rate, error rate, latency, and active instances.',
    'c0000000-0000-0000-0000-000000000001',
    TRUE,
    'service,health,overview,sre',
    '{
      "variables": [
        {"name": "service",     "label": "Service",     "type": "SERVICE",     "defaultValue": null, "currentValue": null},
        {"name": "environment", "label": "Environment", "type": "ENVIRONMENT", "defaultValue": null, "currentValue": null}
      ],
      "widgets": [
        {
          "id": "sh-w1",
          "title": "Request Rate",
          "type": "STAT",
          "gridPos": {"x": 0, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(rate(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\"}[5m]))"
          },
          "options": {"unit": "req/s"}
        },
        {
          "id": "sh-w2",
          "title": "Error Rate %",
          "type": "STAT",
          "gridPos": {"x": 3, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(rate(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\",http_response_status_code=~\"5..\"}[5m])) / sum(rate(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\"}[5m])) * 100"
          },
          "options": {"unit": "%", "thresholds": [1, 5]}
        },
        {
          "id": "sh-w3",
          "title": "P95 Latency",
          "type": "STAT",
          "gridPos": {"x": 6, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "histogram_quantile(0.95, sum by(le) (rate(http_server_request_duration_seconds_bucket{job=\"$service\",environment=\"$environment\"}[5m])))"
          },
          "options": {"unit": "s"}
        },
        {
          "id": "sh-w4",
          "title": "Active Instances",
          "type": "STAT",
          "gridPos": {"x": 9, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "count(up{job=\"$service\",environment=\"$environment\"} == 1)"
          },
          "options": {"unit": ""}
        },
        {
          "id": "sh-w5",
          "title": "Request Rate Over Time",
          "type": "TIME_SERIES",
          "gridPos": {"x": 0, "y": 2, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum by(http_request_method) (rate(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\"}[5m]))"
          },
          "options": {"legend": true, "stacked": false}
        },
        {
          "id": "sh-w6",
          "title": "Latency P99 Over Time",
          "type": "TIME_SERIES",
          "gridPos": {"x": 6, "y": 2, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "histogram_quantile(0.99, sum by(le) (rate(http_server_request_duration_seconds_bucket{job=\"$service\",environment=\"$environment\"}[5m])))"
          },
          "options": {"legend": true, "unit": "s"}
        },
        {
          "id": "sh-w7",
          "title": "Error Rate Over Time",
          "type": "TIME_SERIES",
          "gridPos": {"x": 0, "y": 6, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum by(http_response_status_code) (rate(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\",http_response_status_code=~\"5..\"}[5m]))"
          },
          "options": {"legend": true, "stacked": true}
        },
        {
          "id": "sh-w8",
          "title": "Recent Error Logs",
          "type": "TABLE",
          "gridPos": {"x": 6, "y": 6, "w": 6, "h": 4},
          "dataSource": {
            "type": "ELASTICSEARCH",
            "query": "service.name:\"$service\" AND severity:ERROR"
          },
          "options": {}
        }
      ]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. API Performance
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO dashboards (id, name, description, owner_id, is_template, tags, layout)
VALUES (
    'd0000000-0000-0000-0000-000000000002',
    'API Performance',
    'API throughput, latency distribution, and error breakdown by endpoint and status code.',
    'c0000000-0000-0000-0000-000000000001',
    TRUE,
    'api,performance,latency,throughput',
    '{
      "variables": [
        {"name": "service",     "label": "Service",     "type": "SERVICE",     "defaultValue": null, "currentValue": null},
        {"name": "environment", "label": "Environment", "type": "ENVIRONMENT", "defaultValue": null, "currentValue": null}
      ],
      "widgets": [
        {
          "id": "ap-w1",
          "title": "Total Throughput",
          "type": "STAT",
          "gridPos": {"x": 0, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(rate(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\"}[5m]))"
          },
          "options": {"unit": "req/s"}
        },
        {
          "id": "ap-w2",
          "title": "Avg Latency",
          "type": "STAT",
          "gridPos": {"x": 3, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(rate(http_server_request_duration_seconds_sum{job=\"$service\",environment=\"$environment\"}[5m])) / sum(rate(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\"}[5m]))"
          },
          "options": {"unit": "s"}
        },
        {
          "id": "ap-w3",
          "title": "5xx Errors (1h)",
          "type": "STAT",
          "gridPos": {"x": 6, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(increase(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\",http_response_status_code=~\"5..\"}[1h]))"
          },
          "options": {"unit": "", "thresholds": [1, 10]}
        },
        {
          "id": "ap-w4",
          "title": "4xx Errors (1h)",
          "type": "STAT",
          "gridPos": {"x": 9, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(increase(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\",http_response_status_code=~\"4..\"}[1h]))"
          },
          "options": {"unit": "", "thresholds": [10, 50]}
        },
        {
          "id": "ap-w5",
          "title": "Throughput by Endpoint",
          "type": "TIME_SERIES",
          "gridPos": {"x": 0, "y": 2, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum by(http_route) (rate(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\"}[5m]))"
          },
          "options": {"legend": true, "stacked": true}
        },
        {
          "id": "ap-w6",
          "title": "P95 Latency by Endpoint",
          "type": "TIME_SERIES",
          "gridPos": {"x": 6, "y": 2, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "histogram_quantile(0.95, sum by(le, http_route) (rate(http_server_request_duration_seconds_bucket{job=\"$service\",environment=\"$environment\"}[5m])))"
          },
          "options": {"legend": true, "unit": "s"}
        },
        {
          "id": "ap-w7",
          "title": "Error Breakdown by Status",
          "type": "PIE",
          "gridPos": {"x": 0, "y": 6, "w": 4, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum by(http_response_status_code) (increase(http_server_request_duration_seconds_count{job=\"$service\",environment=\"$environment\",http_response_status_code=~\"[45]..\"}[1h]))"
          },
          "options": {"legend": true}
        },
        {
          "id": "ap-w8",
          "title": "Slowest Endpoints (P99)",
          "type": "BAR",
          "gridPos": {"x": 4, "y": 6, "w": 8, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "topk(10, histogram_quantile(0.99, sum by(le, http_route) (rate(http_server_request_duration_seconds_bucket{job=\"$service\",environment=\"$environment\"}[5m]))))"
          },
          "options": {"legend": false, "unit": "s"}
        }
      ]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Infrastructure
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO dashboards (id, name, description, owner_id, is_template, tags, layout)
VALUES (
    'd0000000-0000-0000-0000-000000000003',
    'Infrastructure',
    'Cluster-level resource utilization: CPU, memory, pods, network, and disk I/O.',
    'c0000000-0000-0000-0000-000000000001',
    TRUE,
    'infrastructure,cpu,memory,disk,network,kubernetes',
    '{
      "variables": [
        {"name": "service",     "label": "Service",     "type": "SERVICE",     "defaultValue": null, "currentValue": null},
        {"name": "environment", "label": "Environment", "type": "ENVIRONMENT", "defaultValue": null, "currentValue": null}
      ],
      "widgets": [
        {
          "id": "in-w1",
          "title": "CPU Usage",
          "type": "GAUGE",
          "gridPos": {"x": 0, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "100 - (avg(rate(node_cpu_seconds_total{mode=\"idle\",environment=\"$environment\"}[5m])) * 100)"
          },
          "options": {"unit": "%", "thresholds": [60, 85]}
        },
        {
          "id": "in-w2",
          "title": "Memory Usage",
          "type": "GAUGE",
          "gridPos": {"x": 3, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "(1 - (node_memory_MemAvailable_bytes{environment=\"$environment\"} / node_memory_MemTotal_bytes{environment=\"$environment\"})) * 100"
          },
          "options": {"unit": "%", "thresholds": [70, 90]}
        },
        {
          "id": "in-w3",
          "title": "Running Pods",
          "type": "STAT",
          "gridPos": {"x": 6, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(kube_pod_status_phase{phase=\"Running\",namespace=~\".*$service.*\"})"
          },
          "options": {"unit": ""}
        },
        {
          "id": "in-w4",
          "title": "Container Restarts (1h)",
          "type": "STAT",
          "gridPos": {"x": 9, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(increase(kube_pod_container_status_restarts_total{namespace=~\".*$service.*\"}[1h]))"
          },
          "options": {"unit": "", "thresholds": [1, 5]}
        },
        {
          "id": "in-w5",
          "title": "CPU Over Time",
          "type": "TIME_SERIES",
          "gridPos": {"x": 0, "y": 2, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "100 - (avg by(instance) (rate(node_cpu_seconds_total{mode=\"idle\",environment=\"$environment\"}[5m])) * 100)"
          },
          "options": {"legend": true, "unit": "%"}
        },
        {
          "id": "in-w6",
          "title": "Memory Over Time",
          "type": "TIME_SERIES",
          "gridPos": {"x": 6, "y": 2, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "(1 - (node_memory_MemAvailable_bytes{environment=\"$environment\"} / node_memory_MemTotal_bytes{environment=\"$environment\"})) * 100"
          },
          "options": {"legend": true, "unit": "%"}
        },
        {
          "id": "in-w7",
          "title": "Network I/O",
          "type": "TIME_SERIES",
          "gridPos": {"x": 0, "y": 6, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum by(instance) (rate(node_network_receive_bytes_total{environment=\"$environment\"}[5m]) + rate(node_network_transmit_bytes_total{environment=\"$environment\"}[5m]))"
          },
          "options": {"legend": true, "unit": "bytes/s"}
        },
        {
          "id": "in-w8",
          "title": "Disk I/O Utilization",
          "type": "TIME_SERIES",
          "gridPos": {"x": 6, "y": 6, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "rate(node_disk_io_time_seconds_total{environment=\"$environment\"}[5m]) * 100"
          },
          "options": {"legend": true, "unit": "%"}
        }
      ]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Database Health
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO dashboards (id, name, description, owner_id, is_template, tags, layout)
VALUES (
    'd0000000-0000-0000-0000-000000000004',
    'Database Health',
    'PostgreSQL health: connections, transactions, deadlocks, replication lag, and cache efficiency.',
    'c0000000-0000-0000-0000-000000000001',
    TRUE,
    'database,postgresql,connections,queries',
    '{
      "variables": [
        {"name": "service",     "label": "Service",     "type": "SERVICE",     "defaultValue": null, "currentValue": null},
        {"name": "environment", "label": "Environment", "type": "ENVIRONMENT", "defaultValue": null, "currentValue": null}
      ],
      "widgets": [
        {
          "id": "db-w1",
          "title": "Active Connections",
          "type": "STAT",
          "gridPos": {"x": 0, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(pg_stat_activity_count{environment=\"$environment\",state=\"active\"})"
          },
          "options": {"unit": ""}
        },
        {
          "id": "db-w2",
          "title": "Transaction Rate",
          "type": "STAT",
          "gridPos": {"x": 3, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(rate(pg_stat_database_xact_commit{environment=\"$environment\"}[5m])) + sum(rate(pg_stat_database_xact_rollback{environment=\"$environment\"}[5m]))"
          },
          "options": {"unit": "tx/s"}
        },
        {
          "id": "db-w3",
          "title": "Deadlocks (1h)",
          "type": "STAT",
          "gridPos": {"x": 6, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(increase(pg_stat_database_deadlocks{environment=\"$environment\"}[1h]))"
          },
          "options": {"unit": "", "thresholds": [1, 5]}
        },
        {
          "id": "db-w4",
          "title": "Replication Lag",
          "type": "STAT",
          "gridPos": {"x": 9, "y": 0, "w": 3, "h": 2},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "max(pg_replication_lag_seconds{environment=\"$environment\"})"
          },
          "options": {"unit": "s", "thresholds": [1, 5]}
        },
        {
          "id": "db-w5",
          "title": "Transactions Over Time",
          "type": "TIME_SERIES",
          "gridPos": {"x": 0, "y": 2, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum by(datname) (rate(pg_stat_database_xact_commit{environment=\"$environment\"}[5m]))"
          },
          "options": {"legend": true, "unit": "tx/s"}
        },
        {
          "id": "db-w6",
          "title": "Connection Pool Usage",
          "type": "TIME_SERIES",
          "gridPos": {"x": 6, "y": 2, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum by(state) (pg_stat_activity_count{environment=\"$environment\"})"
          },
          "options": {"legend": true, "stacked": true}
        },
        {
          "id": "db-w7",
          "title": "Cache Hit Ratio",
          "type": "TIME_SERIES",
          "gridPos": {"x": 0, "y": 6, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum(pg_stat_database_blks_hit{environment=\"$environment\"}) / (sum(pg_stat_database_blks_hit{environment=\"$environment\"}) + sum(pg_stat_database_blks_read{environment=\"$environment\"})) * 100"
          },
          "options": {"legend": true, "unit": "%", "thresholds": [90, 95]}
        },
        {
          "id": "db-w8",
          "title": "Rollback Rate",
          "type": "TIME_SERIES",
          "gridPos": {"x": 6, "y": 6, "w": 6, "h": 4},
          "dataSource": {
            "type": "PROMETHEUS",
            "query": "sum by(datname) (rate(pg_stat_database_xact_rollback{environment=\"$environment\"}[5m]))"
          },
          "options": {"legend": true, "unit": "tx/s"}
        }
      ]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;
