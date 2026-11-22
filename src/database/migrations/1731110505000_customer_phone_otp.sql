-- Up Migration
-- Phone lookup for OTP login + short-lived OTP challenges.

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON customers (phone)
  WHERE phone IS NOT NULL AND length(trim(phone)) > 0;

CREATE TABLE customer_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_otp_challenges_phone_created
  ON customer_otp_challenges (phone, created_at DESC);

-- Down Migration
DROP TABLE IF EXISTS customer_otp_challenges;
DROP INDEX IF EXISTS customers_phone_unique;
