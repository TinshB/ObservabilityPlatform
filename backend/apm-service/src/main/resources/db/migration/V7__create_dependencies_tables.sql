-- Story 11.3: Dependency graph tables
-- ─────────────────────────────────────

CREATE TABLE dependencies (
    id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source_service_id       UUID         NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    target_service_name     VARCHAR(255) NOT NULL,
    dependency_type         VARCHAR(50)  NOT NULL CHECK (dependency_type IN ('HTTP', 'GRPC', 'DATABASE', 'CLOUD')),
    db_system               VARCHAR(100),
    target_type             VARCHAR(50)  NOT NULL CHECK (target_type IN ('SERVICE', 'DATABASE', 'CLOUD_COMPONENT')),
    display_name            VARCHAR(255),
    last_seen_at            TIMESTAMPTZ,
    call_count_1h           BIGINT       NOT NULL DEFAULT 0,
    error_count_1h          BIGINT       NOT NULL DEFAULT 0,
    avg_latency_ms_1h       DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),

    UNIQUE(source_service_id, target_service_name, dependency_type)
);

CREATE INDEX idx_dependencies_source  ON dependencies(source_service_id);
CREATE INDEX idx_dependencies_target  ON dependencies(target_service_name);
CREATE INDEX idx_dependencies_type    ON dependencies(dependency_type);
CREATE INDEX idx_dependencies_active  ON dependencies(is_active);
