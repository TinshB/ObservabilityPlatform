-- ============================================================================
-- Billing Snapshots — Daily cost rollups for trend analysis
-- US-BILL-012: Monthly Billing Trend Chart
-- ============================================================================

CREATE TABLE billing_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date   DATE           NOT NULL,
    category        VARCHAR(20)    NOT NULL,       -- STORAGE, COMPUTE, LICENCE
    resource_type   VARCHAR(50)    NOT NULL,        -- e.g. elasticsearch_gb, cpu_core_hour, licence_admin
    signal_type     VARCHAR(10),                    -- LOG, TRACE, METRIC (nullable for non-signal categories)
    service_id      UUID,                           -- FK to services (nullable for aggregate entries)
    quantity        DECIMAL(12,4)  NOT NULL DEFAULT 0,  -- e.g. GB stored, core-hours used
    cost_usd        DECIMAL(10,4)  NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_snap_category CHECK (category IN ('STORAGE', 'COMPUTE', 'LICENCE')),
    CONSTRAINT chk_snap_cost_positive CHECK (cost_usd >= 0)
);

CREATE INDEX idx_snapshots_date_cat ON billing_snapshots (snapshot_date, category);
CREATE INDEX idx_snapshots_date_range ON billing_snapshots (snapshot_date);
CREATE UNIQUE INDEX idx_snapshots_unique ON billing_snapshots (snapshot_date, category, resource_type)
    WHERE service_id IS NULL AND signal_type IS NULL;

-- ── Seed 3 months of sample data for trend visualization ─────────────────────
-- Generates daily entries for Jan, Feb, Mar 2026 across Storage, Compute, Licence

-- Storage — Elasticsearch (logs)
INSERT INTO billing_snapshots (snapshot_date, category, resource_type, signal_type, quantity, cost_usd)
SELECT
    d::date,
    'STORAGE',
    'elasticsearch_gb',
    'LOG',
    -- ~50 GB base + slight daily growth + noise
    ROUND((50 + (d::date - '2026-01-01'::date) * 0.3 + (random() * 5 - 2.5))::numeric, 2),
    ROUND(((50 + (d::date - '2026-01-01'::date) * 0.3 + (random() * 5 - 2.5)) * 0.25)::numeric, 4)
FROM generate_series('2026-01-01'::date, '2026-03-22'::date, '1 day') AS d;

-- Storage — Prometheus (metrics)
INSERT INTO billing_snapshots (snapshot_date, category, resource_type, signal_type, quantity, cost_usd)
SELECT
    d::date,
    'STORAGE',
    'prometheus_gb',
    'METRIC',
    ROUND((20 + (d::date - '2026-01-01'::date) * 0.15 + (random() * 3 - 1.5))::numeric, 2),
    ROUND(((20 + (d::date - '2026-01-01'::date) * 0.15 + (random() * 3 - 1.5)) * 0.15)::numeric, 4)
FROM generate_series('2026-01-01'::date, '2026-03-22'::date, '1 day') AS d;

-- Storage — Jaeger (traces)
INSERT INTO billing_snapshots (snapshot_date, category, resource_type, signal_type, quantity, cost_usd)
SELECT
    d::date,
    'STORAGE',
    'jaeger_gb',
    'TRACE',
    ROUND((30 + (d::date - '2026-01-01'::date) * 0.2 + (random() * 4 - 2))::numeric, 2),
    ROUND(((30 + (d::date - '2026-01-01'::date) * 0.2 + (random() * 4 - 2)) * 0.20)::numeric, 4)
FROM generate_series('2026-01-01'::date, '2026-03-22'::date, '1 day') AS d;

-- Compute — CPU
INSERT INTO billing_snapshots (snapshot_date, category, resource_type, quantity, cost_usd)
SELECT
    d::date,
    'COMPUTE',
    'cpu_core_hour',
    ROUND((200 + (d::date - '2026-01-01'::date) * 1.0 + (random() * 30 - 15))::numeric, 2),
    ROUND(((200 + (d::date - '2026-01-01'::date) * 1.0 + (random() * 30 - 15)) * 0.048)::numeric, 4)
FROM generate_series('2026-01-01'::date, '2026-03-22'::date, '1 day') AS d;

-- Compute — Memory
INSERT INTO billing_snapshots (snapshot_date, category, resource_type, quantity, cost_usd)
SELECT
    d::date,
    'COMPUTE',
    'memory_gb_hour',
    ROUND((500 + (d::date - '2026-01-01'::date) * 2.0 + (random() * 50 - 25))::numeric, 2),
    ROUND(((500 + (d::date - '2026-01-01'::date) * 2.0 + (random() * 50 - 25)) * 0.0065)::numeric, 4)
FROM generate_series('2026-01-01'::date, '2026-03-22'::date, '1 day') AS d;

-- Licence — Monthly snapshots (one per day representing the licence cost for that day)
INSERT INTO billing_snapshots (snapshot_date, category, resource_type, quantity, cost_usd)
SELECT
    d::date,
    'LICENCE',
    'licence_users',
    -- user count grows slightly over time
    (10 + FLOOR((d::date - '2026-01-01'::date) / 15))::numeric,
    -- daily portion of monthly licence cost: (users * avg $30/user) / 30 days
    ROUND(((10 + FLOOR((d::date - '2026-01-01'::date) / 15)) * 30.0 / 30)::numeric, 4)
FROM generate_series('2026-01-01'::date, '2026-03-22'::date, '1 day') AS d;
