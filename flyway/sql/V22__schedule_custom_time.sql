-- Allow custom schedule time instead of hardcoded 06:00 UTC
ALTER TABLE report_schedules ADD COLUMN schedule_hour   SMALLINT NOT NULL DEFAULT 6;
ALTER TABLE report_schedules ADD COLUMN schedule_minute SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE report_schedules ADD COLUMN day_of_week     SMALLINT;  -- 1=MON..7=SUN, NULL for DAILY/MONTHLY
ALTER TABLE report_schedules ADD COLUMN day_of_month    SMALLINT;  -- 1-28, NULL for DAILY/WEEKLY
