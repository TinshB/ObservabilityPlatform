-- ============================================================
-- Sprint 14 — Report Service database schema
-- ============================================================

-- Report records: each generated report is tracked here
CREATE TABLE reports (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    report_type       VARCHAR(20)  NOT NULL CHECK (report_type IN ('KPI', 'PERFORMANCE')),
    report_format     VARCHAR(10)  NOT NULL DEFAULT 'PDF' CHECK (report_format IN ('PDF')),
    status            VARCHAR(20)  NOT NULL CHECK (status IN ('QUEUED', 'GENERATING', 'COMPLETED', 'FAILED')),
    requested_by      VARCHAR(255) NOT NULL,
    service_id        UUID,
    service_name      VARCHAR(255),
    time_range_start  TIMESTAMP WITH TIME ZONE,
    time_range_end    TIMESTAMP WITH TIME ZONE,
    file_path         VARCHAR(1024),
    file_size_bytes   BIGINT,
    error_message     VARCHAR(2000),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at      TIMESTAMP WITH TIME ZONE,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_requested_by ON reports (requested_by);
CREATE INDEX idx_reports_report_type  ON reports (report_type);
CREATE INDEX idx_reports_status       ON reports (status);
CREATE INDEX idx_reports_created_at   ON reports (created_at DESC);

-- Report delivery schedules: defines recurring email delivery
CREATE TABLE report_schedules (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    report_type      VARCHAR(20)  NOT NULL CHECK (report_type IN ('KPI', 'PERFORMANCE')),
    frequency        VARCHAR(20)  NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    cron_expression  VARCHAR(100) NOT NULL,
    recipients       VARCHAR(2000) NOT NULL,
    service_id       UUID,
    service_name     VARCHAR(255),
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by       VARCHAR(255) NOT NULL,
    last_run_at      TIMESTAMP WITH TIME ZONE,
    next_run_at      TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_schedules_active     ON report_schedules (is_active);
CREATE INDEX idx_report_schedules_created_by ON report_schedules (created_by);
