-- Allow multiple API configurations within a single workflow step.
-- Multiple rows can share the same (workflow_id, step_order) to represent
-- parallel APIs in a single stage.

ALTER TABLE workflow_steps
    DROP CONSTRAINT IF EXISTS workflow_steps_workflow_id_step_order_key;

-- Replace with a non-unique index for query performance
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_order
    ON workflow_steps (workflow_id, step_order);
