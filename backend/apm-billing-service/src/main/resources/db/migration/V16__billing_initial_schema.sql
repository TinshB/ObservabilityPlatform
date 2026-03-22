-- ============================================================================
-- Billing & Cost Management — Initial Schema
-- US-BILL-001: Billing rate cards for cost calculation
-- ============================================================================

CREATE TABLE billing_rate_cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        VARCHAR(20)    NOT NULL,       -- STORAGE, COMPUTE, LICENCE
    resource_type   VARCHAR(50)    NOT NULL,       -- e.g. elasticsearch_gb, cpu_core_hour
    unit_cost_usd   DECIMAL(10,4)  NOT NULL,
    effective_from  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    effective_to    TIMESTAMPTZ,                   -- NULL = currently active
    created_by      UUID,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_category CHECK (category IN ('STORAGE', 'COMPUTE', 'LICENCE')),
    CONSTRAINT chk_cost_positive CHECK (unit_cost_usd >= 0)
);

CREATE INDEX idx_rate_cards_lookup ON billing_rate_cards (category, resource_type, effective_from);

-- ── Seed default rate cards ─────────────────────────────────────────────────

-- Storage rates (USD per GB per month)
INSERT INTO billing_rate_cards (category, resource_type, unit_cost_usd, effective_from) VALUES
    ('STORAGE', 'elasticsearch_gb', 0.2500, NOW()),
    ('STORAGE', 'prometheus_gb',    0.1500, NOW()),
    ('STORAGE', 'jaeger_gb',        0.2000, NOW());

-- Compute rates (USD per unit per hour)
INSERT INTO billing_rate_cards (category, resource_type, unit_cost_usd, effective_from) VALUES
    ('COMPUTE', 'cpu_core_hour',    0.0480, NOW()),
    ('COMPUTE', 'memory_gb_hour',   0.0065, NOW());
