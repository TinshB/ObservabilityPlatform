-- Story 13.1 — Dashboard tables with JSONB widget layout
-- ─────────────────────────────────────────────────────────

CREATE TABLE dashboards (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    description     VARCHAR(1000),
    owner_id        UUID            NOT NULL,
    is_template     BOOLEAN         NOT NULL DEFAULT FALSE,
    tags            VARCHAR(500),
    layout          JSONB           NOT NULL DEFAULT '{"widgets":[],"variables":[]}',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboards_owner_id    ON dashboards (owner_id);
CREATE INDEX idx_dashboards_is_template ON dashboards (is_template);
CREATE INDEX idx_dashboards_name        ON dashboards (name);
