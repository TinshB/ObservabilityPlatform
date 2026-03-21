-- Story 11.2: Alert grouping and notification suppression
-- ─────────────────────────────────────────────────────────

-- Add grouping key and suppression window to SLA rules.
-- group_key:          Labels to group alerts by (e.g. "service", "service+severity"). Default: "service".
-- suppression_window: After a notification is sent, suppress duplicates for this duration (e.g. "15m").
ALTER TABLE sla_rules
    ADD COLUMN group_key           VARCHAR(100) NOT NULL DEFAULT 'service',
    ADD COLUMN suppression_window  VARCHAR(20)  NOT NULL DEFAULT '15m';

-- Track notification state on each alert.
-- last_notified_at:  Timestamp of last notification dispatch (used for suppression).
-- notification_count: How many notifications have been sent for this alert.
ALTER TABLE alerts
    ADD COLUMN last_notified_at    TIMESTAMPTZ,
    ADD COLUMN notification_count  INT NOT NULL DEFAULT 0;
