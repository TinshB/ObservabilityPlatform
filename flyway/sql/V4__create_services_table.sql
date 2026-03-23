-- =============================================================================
-- V1: Create Service Catalog table
-- =============================================================================

CREATE TABLE services (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL UNIQUE,
    description         VARCHAR(1000),
    owner_team          VARCHAR(255),
    environment         VARCHAR(50),
    tier                VARCHAR(50),
    metrics_enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    logs_enabled        BOOLEAN      NOT NULL DEFAULT TRUE,
    traces_enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    registration_source VARCHAR(50)  NOT NULL DEFAULT 'MANUAL',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Indexes for frequent lookups and filtering
CREATE INDEX idx_services_name        ON services(name);
CREATE INDEX idx_services_environment ON services(environment);
CREATE INDEX idx_services_owner_team  ON services(owner_team);
CREATE INDEX idx_services_is_active   ON services(is_active);
CREATE INDEX idx_services_reg_source  ON services(registration_source);
