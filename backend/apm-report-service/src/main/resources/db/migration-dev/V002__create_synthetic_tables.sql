-- Sprint 14: Synthetic Monitoring tables (H2-compatible)

CREATE TABLE synthetic_checks (
    id                     UUID DEFAULT random_uuid() PRIMARY KEY,
    name                   VARCHAR(255) NOT NULL,
    service_id             UUID,
    service_name           VARCHAR(255),
    url                    VARCHAR(2048) NOT NULL,
    http_method            VARCHAR(10) NOT NULL,
    request_headers        VARCHAR(4000),
    request_body           VARCHAR(4000),
    schedule_cron          VARCHAR(100) NOT NULL,
    timeout_ms             INT NOT NULL DEFAULT 5000,
    expected_status_code   INT,
    expected_body_contains VARCHAR(1000),
    max_latency_ms         INT,
    sla_rule_id            UUID,
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_by             VARCHAR(255) NOT NULL,
    created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_synthetic_checks_active ON synthetic_checks(is_active);
CREATE INDEX idx_synthetic_checks_service ON synthetic_checks(service_name);
CREATE INDEX idx_synthetic_checks_created_at ON synthetic_checks(created_at);

CREATE TABLE synthetic_results (
    id                    UUID DEFAULT random_uuid() PRIMARY KEY,
    check_id              UUID NOT NULL,
    check_name            VARCHAR(255),
    status_code           INT,
    latency_ms            BIGINT,
    success               BOOLEAN NOT NULL,
    status_code_match     BOOLEAN,
    body_match            BOOLEAN,
    latency_match         BOOLEAN,
    error_message         VARCHAR(2000),
    response_body_snippet VARCHAR(2000),
    executed_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_synthetic_results_check_id ON synthetic_results(check_id);
CREATE INDEX idx_synthetic_results_executed_at ON synthetic_results(executed_at);
CREATE INDEX idx_synthetic_results_success ON synthetic_results(check_id, success);
