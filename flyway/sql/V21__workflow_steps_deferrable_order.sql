-- Make workflow step order constraint deferrable so steps can be reordered within a transaction.
-- Also allows auto-shifting existing steps when inserting at a specific position.

ALTER TABLE workflow_steps
    DROP CONSTRAINT workflow_steps_workflow_id_step_order_key;

ALTER TABLE workflow_steps
    ADD CONSTRAINT workflow_steps_workflow_id_step_order_key
    UNIQUE (workflow_id, step_order)
    DEFERRABLE INITIALLY DEFERRED;
