-- AI/ML job tracking tables

CREATE TABLE ai_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type        VARCHAR(50)  NOT NULL,          -- ANOMALY_DETECTION, ROOT_CAUSE, FORECAST
    service_name    VARCHAR(255) NOT NULL,
    status          VARCHAR(30)  NOT NULL DEFAULT 'PENDING',  -- PENDING, RUNNING, COMPLETED, FAILED
    request_payload JSONB,
    result_payload  JSONB,
    error_message   TEXT,
    execution_ms    BIGINT,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at    TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ai_jobs_service   ON ai_jobs (service_name);
CREATE INDEX idx_ai_jobs_type      ON ai_jobs (job_type);
CREATE INDEX idx_ai_jobs_status    ON ai_jobs (status);
CREATE INDEX idx_ai_jobs_created   ON ai_jobs (created_at DESC);
