-- Up Migration
-- Storefront carts (guest via session_id, customer via customer_id).
-- Line prices are never stored as authority; API always reprices from catalog.

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  session_id TEXT,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT carts_owner_check CHECK (
    customer_id IS NOT NULL OR (session_id IS NOT NULL AND length(trim(session_id)) > 0)
  )
);

CREATE UNIQUE INDEX carts_customer_id_unique
  ON carts (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX carts_guest_session_id_unique
  ON carts (session_id)
  WHERE customer_id IS NULL AND session_id IS NOT NULL;

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT cart_items_cart_variant_unique UNIQUE (cart_id, variant_id)
);

CREATE INDEX idx_cart_items_cart_id ON cart_items (cart_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items (variant_id);
CREATE INDEX idx_carts_session_id ON carts (session_id);

-- Down Migration
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
