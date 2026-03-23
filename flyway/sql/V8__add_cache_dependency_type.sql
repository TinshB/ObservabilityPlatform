-- Add CACHE as a supported dependency_type and target_type.
-- Redis, Memcached, Valkey, etc. were previously lumped under DATABASE.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE dependencies
    DROP CONSTRAINT IF EXISTS dependencies_dependency_type_check;

ALTER TABLE dependencies
    ADD CONSTRAINT dependencies_dependency_type_check
    CHECK (dependency_type IN ('HTTP', 'GRPC', 'DATABASE', 'CLOUD', 'CACHE'));

ALTER TABLE dependencies
    DROP CONSTRAINT IF EXISTS dependencies_target_type_check;

ALTER TABLE dependencies
    ADD CONSTRAINT dependencies_target_type_check
    CHECK (target_type IN ('SERVICE', 'DATABASE', 'CLOUD_COMPONENT', 'CACHE'));

-- Migrate existing Redis/Memcached/Valkey rows from DATABASE → CACHE
UPDATE dependencies
SET dependency_type = 'CACHE',
    target_type     = 'CACHE'
WHERE dependency_type = 'DATABASE'
  AND db_system IN ('redis', 'memcached', 'valkey');
