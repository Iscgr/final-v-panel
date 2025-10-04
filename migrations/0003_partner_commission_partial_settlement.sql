-- Migration 0003: Add partial settlement support to partner_commission_payments
-- Adds settled_amount and last_partial_settlement_at columns
-- Pre-conditions: table partner_commission_payments already exists.

ALTER TABLE partner_commission_payments
  ADD COLUMN IF NOT EXISTS settled_amount numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE partner_commission_payments
  ADD COLUMN IF NOT EXISTS last_partial_settlement_at timestamp NULL;

-- Verification (manual):
-- \d+ partner_commission_payments  (PostgreSQL psql)
-- Columns should list settled_amount (default 0) and last_partial_settlement_at (nullable).

-- Rollback (manual):
-- ALTER TABLE partner_commission_payments DROP COLUMN IF EXISTS last_partial_settlement_at;
-- ALTER TABLE partner_commission_payments DROP COLUMN IF EXISTS settled_amount;
