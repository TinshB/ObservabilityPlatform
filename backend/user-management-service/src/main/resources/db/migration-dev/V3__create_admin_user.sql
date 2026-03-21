-- =============================================================================
-- V3: Create default admin user and assign ADMIN role
-- =============================================================================

INSERT INTO users (id, username, email, password_hash, auth_provider, created_at, updated_at, active)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'admin',
    'admin@observability.local',
    '$2a$10$Rt5HSELUzid08fB18lusQ./xm5eyB9a/a4hVxYNFLApPiTmhyvXfS',
    'LOCAL',
    now(),
    now(),
    TRUE
);

INSERT INTO user_roles (user_id, role_id)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001'
);
