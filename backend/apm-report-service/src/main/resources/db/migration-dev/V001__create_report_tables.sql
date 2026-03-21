-- Sprint 14: Report Service schema (H2-compatible)

CREATE TABLE reports (
    id               UUID DEFAULT random_uuid() PRIMARY KEY,
    name             VARCHAR(255) NOT NULL,
    report_type      VARCHAR(20) NOT NULL,
    report_format    VARCHAR(10) NOT NULL DEFAULT 'PDF',
    status           VARCHAR(20) NOT NULL,
    requested_by     VARCHAR(255) NOT NULL,
    service_id       UUID,
    service_name     VARCHAR(255),
    time_range_start TIMESTAMP WITH TIME ZONE,
    time_range_end   TIMESTAMP WITH TIME ZONE,
    file_path        VARCHAR(1024),
    file_size_bytes  BIGINT,
    error_message    VARCHAR(2000),
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at     TIMESTAMP WITH TIME ZONE,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reports_requested_by ON reports(requested_by);
CREATE INDEX idx_reports_report_type ON reports(report_type);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at);

CREATE TABLE report_schedules (
    id              UUID DEFAULT random_uuid() PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    report_type     VARCHAR(20) NOT NULL,
    frequency       VARCHAR(20) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    recipients      VARCHAR(2000) NOT NULL,
    service_id      UUID,
    service_name    VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(255) NOT NULL,
    last_run_at     TIMESTAMP WITH TIME ZONE,
    next_run_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_report_schedules_active ON report_schedules(is_active);
CREATE INDEX idx_report_schedules_created_by ON report_schedules(created_by);
