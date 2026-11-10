-- Up Migration
-- Storefront customer credentials + password reset tokens.
-- Existing customers rows (order guests) may lack passwords; register always sets them.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS normalized_email TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE customers
SET normalized_email = lower(trim(email))
WHERE email IS NOT NULL
  AND (normalized_email IS NULL OR normalized_email = '');

CREATE UNIQUE INDEX IF NOT EXISTS customers_normalized_email_unique
  ON customers (normalized_email)
  WHERE normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers (is_active);

CREATE TABLE customer_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_password_resets_customer_id
  ON customer_password_resets (customer_id);

CREATE INDEX idx_customer_password_resets_expires_at
  ON customer_password_resets (expires_at);

CREATE INDEX idx_customer_addresses_customer_id_created
  ON customer_addresses (customer_id, created_at DESC);

-- Down Migration
DROP INDEX IF EXISTS idx_customer_addresses_customer_id_created;
DROP TABLE IF EXISTS customer_password_resets;
DROP INDEX IF EXISTS idx_customers_is_active;
DROP INDEX IF EXISTS customers_normalized_email_unique;
ALTER TABLE customers
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS password_hash,
  DROP COLUMN IF EXISTS normalized_email;
