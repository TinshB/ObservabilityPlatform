-- Widen http_method columns to handle non-standard values gracefully
ALTER TABLE flow_pattern_steps ALTER COLUMN http_method TYPE VARCHAR(20);
ALTER TABLE flow_pattern_edges ALTER COLUMN http_method TYPE VARCHAR(20);
