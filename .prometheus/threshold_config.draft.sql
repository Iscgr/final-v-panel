-- DRAFT DDL: threshold_config (Phase C – E-C4 groundwork)
-- Status: NOT APPLIED (do not include in migration / drizzle push yet)
-- Purpose: Central configurable thresholds for reliability & integrity alerting layers.
-- Notes:
--  - This draft is version 1; further fields (severity_weights, description_i18n) may be added after initial wiring.
--  - Do NOT rename columns without updating alert wiring service design.

CREATE TABLE threshold_config (
  id SERIAL PRIMARY KEY,
  metric_code TEXT NOT NULL UNIQUE,               -- e.g. 'outbox_failure_rate', 'outbox_avg_retry', 'outbox_latency_p95'
  warn_threshold NUMERIC(18,6) NOT NULL,          -- numeric to allow fractional ppm or ratios
  critical_threshold NUMERIC(18,6) NOT NULL,      -- must be >= warn_threshold (enforced by future constraint)
  window_minutes INTEGER NOT NULL DEFAULT 60,     -- evaluation window (rolling)
  comparison_operator TEXT NOT NULL DEFAULT '>' , -- '>' | '>=' | '<' | '<=' | 'between' (future extension)
  enabled BOOLEAN NOT NULL DEFAULT true,
  auto_suspend_on_breach BOOLEAN NOT NULL DEFAULT false, -- future safety hook
  meta JSONB DEFAULT '{}'::jsonb,                -- free-form metadata (e.g. unit: 'percent', escalationPolicy)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Proposed seed rows (NOT APPLIED):
-- INSERT INTO threshold_config(metric_code, warn_threshold, critical_threshold, window_minutes) VALUES
-- ('outbox_failure_rate', 1.0, 2.0, 60),             -- percent
-- ('outbox_avg_retry', 1.5, 2.5, 60),                -- average retries
-- ('outbox_latency_p95', 5000, 8000, 60);            -- milliseconds

-- Future Constraints (to be added when table is actually created):
-- ALTER TABLE threshold_config ADD CONSTRAINT chk_threshold_order CHECK (critical_threshold >= warn_threshold);
-- CREATE INDEX idx_threshold_config_enabled ON threshold_config(enabled);

-- End of DDL draft.
