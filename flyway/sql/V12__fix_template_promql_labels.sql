-- =============================================================================
-- V12: Fix PromQL label names in dashboard templates
--      service_name -> job  (Prometheus uses "job" for service identification)
--      deployment_environment -> environment
-- =============================================================================

-- Replace service_name with job and deployment_environment with environment
-- in all 4 template dashboard layouts
UPDATE dashboards
SET layout = REPLACE(
               REPLACE(layout::text,
                 'service_name=',
                 'job='),
               'deployment_environment=',
               'environment=')::jsonb,
    updated_at = now()
WHERE id IN (
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000004'
);
