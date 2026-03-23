-- Story 12.1–12.3: Business Workflow Mapping tables

CREATE TABLE workflows (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL UNIQUE,
    description         VARCHAR(1000),
    owner_team          VARCHAR(255),
    max_duration_ms     INT,
    max_error_rate_pct  DOUBLE PRECISION,
    enabled             BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE workflow_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         UUID         NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    step_order          INT          NOT NULL,
    service_name        VARCHAR(255) NOT NULL,
    http_method         VARCHAR(10)  NOT NULL,
    path_pattern        VARCHAR(500) NOT NULL,
    label               VARCHAR(255),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE(workflow_id, step_order)
);

CREATE TABLE workflow_instances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         UUID         NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    trace_id            VARCHAR(64)  NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'IN_PROGRESS'
                        CHECK (status IN ('IN_PROGRESS', 'COMPLETE', 'FAILED')),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    total_duration_ms   BIGINT,
    error               BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE(workflow_id, trace_id)
);

CREATE TABLE workflow_instance_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id         UUID         NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id             UUID         NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    span_id             VARCHAR(64)  NOT NULL,
    service_name        VARCHAR(255) NOT NULL,
    operation_name      VARCHAR(500),
    duration_ms         BIGINT,
    http_status         INT,
    error               BOOLEAN      NOT NULL DEFAULT FALSE,
    started_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
