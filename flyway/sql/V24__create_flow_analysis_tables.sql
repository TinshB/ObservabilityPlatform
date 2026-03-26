-- Flow Analysis tables for AI-powered service flow diagram generation

-- Stores flow analysis job metadata
CREATE TABLE flow_analyses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'IN_PROGRESS'
                            CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')),
    service_ids             TEXT         NOT NULL,                   -- comma-separated UUIDs
    service_names           TEXT,                                    -- comma-separated names (denormalized)
    time_range_start        TIMESTAMP WITH TIME ZONE NOT NULL,
    time_range_end          TIMESTAMP WITH TIME ZONE NOT NULL,
    operation_filter        VARCHAR(500),
    trace_sample_limit      INT          NOT NULL DEFAULT 1000,
    traces_analyzed         INT,
    error_message           VARCHAR(1000),
    completed_at            TIMESTAMP WITH TIME ZONE,
    expires_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_flow_analyses_user      ON flow_analyses (user_id);
CREATE INDEX idx_flow_analyses_status    ON flow_analyses (status);
CREATE INDEX idx_flow_analyses_created   ON flow_analyses (created_at DESC);
CREATE INDEX idx_flow_analyses_expires   ON flow_analyses (expires_at);

-- Stores discovered flow patterns for an analysis
CREATE TABLE flow_patterns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id             UUID         NOT NULL REFERENCES flow_analyses(id) ON DELETE CASCADE,
    name                    VARCHAR(255),
    frequency               INT          NOT NULL DEFAULT 0,
    avg_latency_ms          DOUBLE PRECISION,
    p50_latency_ms          DOUBLE PRECISION,
    p95_latency_ms          DOUBLE PRECISION,
    p99_latency_ms          DOUBLE PRECISION,
    error_rate              DOUBLE PRECISION DEFAULT 0,
    sample_trace_ids        TEXT,                                    -- comma-separated trace IDs
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_flow_patterns_analysis  ON flow_patterns (analysis_id);

-- Stores ordered steps within a flow pattern
CREATE TABLE flow_pattern_steps (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id              UUID         NOT NULL REFERENCES flow_patterns(id) ON DELETE CASCADE,
    step_order              INT          NOT NULL,
    service_name            VARCHAR(255) NOT NULL,
    service_type            VARCHAR(50)  NOT NULL
                            CHECK (service_type IN ('UI', 'BACKEND', 'DATABASE', 'CLOUD_COMPONENT', 'QUEUE', 'EXTERNAL')),
    http_method             VARCHAR(10),
    path_pattern            VARCHAR(500),
    avg_latency_ms          DOUBLE PRECISION,
    error_rate              DOUBLE PRECISION DEFAULT 0,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(pattern_id, step_order)
);

CREATE INDEX idx_flow_pattern_steps_pattern ON flow_pattern_steps (pattern_id);

-- Stores graph edges for visualization
CREATE TABLE flow_pattern_edges (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id              UUID         NOT NULL REFERENCES flow_patterns(id) ON DELETE CASCADE,
    source_service          VARCHAR(255) NOT NULL,
    target_service          VARCHAR(255) NOT NULL,
    call_count              INT          NOT NULL DEFAULT 0,
    avg_latency_ms          DOUBLE PRECISION,
    error_rate              DOUBLE PRECISION DEFAULT 0,
    http_method             VARCHAR(10),
    http_path               VARCHAR(500),
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_flow_pattern_edges_pattern ON flow_pattern_edges (pattern_id);

-- Stores user's saved service selection presets
CREATE TABLE flow_analysis_presets (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         UUID,
    name                            VARCHAR(255) NOT NULL,
    service_ids                     TEXT         NOT NULL,            -- comma-separated UUIDs
    default_time_range_minutes      INT          DEFAULT 60,
    created_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, name)
);

CREATE INDEX idx_flow_presets_user ON flow_analysis_presets (user_id);
