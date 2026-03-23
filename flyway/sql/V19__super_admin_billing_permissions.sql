-- =============================================================================
-- V4: SUPER_ADMIN role, Billing permissions, Admin access restrictions
-- =============================================================================

-- ── New Billing Permissions ─────────────────────────────────────────────────
INSERT INTO permissions (id, resource, action) VALUES
    ('b0000000-0000-0000-0000-000000000022', 'BILLING', 'READ'),
    ('b0000000-0000-0000-0000-000000000023', 'BILLING', 'WRITE'),
    ('b0000000-0000-0000-0000-000000000024', 'BILLING', 'MANAGE_TIERS');

-- ── SUPER_ADMIN Role ────────────────────────────────────────────────────────
INSERT INTO roles (id, name, description) VALUES
    ('a0000000-0000-0000-0000-000000000004', 'SUPER_ADMIN', 'Super administrator with unrestricted access across all modules including billing tier management and role creation');

-- ── SUPER_ADMIN: All existing permissions + all billing permissions ─────────
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'a0000000-0000-0000-0000-000000000004', id FROM permissions;

-- ── Restrict ADMIN: Remove ROLES:CREATE ─────────────────────────────────────
DELETE FROM role_permissions
WHERE role_id = 'a0000000-0000-0000-0000-000000000001'
  AND permission_id = 'b0000000-0000-0000-0000-000000000005'; -- ROLES:CREATE

-- ── Grant ADMIN: BILLING:READ and BILLING:WRITE (but NOT MANAGE_TIERS) ─────
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000022'),  -- BILLING:READ
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000023');  -- BILLING:WRITE

-- ── Grant OPERATOR: BILLING:READ (view-only) ───────────────────────────────
INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000022');  -- BILLING:READ

-- ── Create default super_admin user ─────────────────────────────────────────
INSERT INTO users (id, username, email, password_hash, auth_provider, created_at, updated_at, active)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'superadmin',
    'superadmin@observability.local',
    '$2a$10$HbqjcRW9HGlOheS4blyP.u/LzrnO9Ycs6lC6EU/U4nNhzqdjJwqCW',  -- password: "admin"
    'LOCAL',
    now(),
    now(),
    TRUE
);

INSERT INTO user_roles (user_id, role_id) VALUES
    ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004');  -- SUPER_ADMIN
