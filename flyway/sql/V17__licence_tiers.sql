-- ============================================================================
-- US-BILL-009: Licence Tiers — fixed monthly cost per user type
-- ============================================================================

CREATE TABLE licence_tiers (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name        VARCHAR(50)    NOT NULL,
    user_type        VARCHAR(30)    NOT NULL UNIQUE,
    monthly_cost_usd DECIMAL(10,2)  NOT NULL,
    is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_monthly_cost_positive CHECK (monthly_cost_usd >= 0)
);

CREATE INDEX idx_licence_tiers_user_type ON licence_tiers (user_type);

-- ── Seed default licence tiers ──────────────────────────────────────────────
INSERT INTO licence_tiers (tier_name, user_type, monthly_cost_usd) VALUES
    ('Administrator', 'ADMIN',    50.00),
    ('Operator',      'OPERATOR', 30.00),
    ('Viewer',        'VIEWER',   10.00);
