-- Up Migration
-- Checkout extras on orders + idempotency keys for place-order retries.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_method_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_note TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;

CREATE TABLE store_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_idempotency_keys_scope_key_unique UNIQUE (customer_id, scope, idempotency_key)
);

CREATE INDEX idx_store_idempotency_keys_created
  ON store_idempotency_keys (created_at DESC);

-- Down Migration
DROP TABLE IF EXISTS store_idempotency_keys;
ALTER TABLE orders
  DROP COLUMN IF EXISTS coupon_code,
  DROP COLUMN IF EXISTS shipping_address_snapshot,
  DROP COLUMN IF EXISTS customer_note,
  DROP COLUMN IF EXISTS shipping_method_id;
