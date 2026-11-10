-- Up Migration
CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_locations_code_unique UNIQUE (code)
);

CREATE TABLE inventory_levels (
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, location_id),
  CONSTRAINT inventory_levels_on_hand_check CHECK (quantity_on_hand >= 0),
  CONSTRAINT inventory_levels_reserved_check CHECK (quantity_reserved >= 0),
  CONSTRAINT inventory_levels_reserved_lte_on_hand_check CHECK (
    quantity_reserved <= quantity_on_hand
  )
);

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_delta_nonzero_check CHECK (delta <> 0)
);

INSERT INTO inventory_locations (name, code, is_active)
VALUES ('Default Warehouse', 'DEFAULT', TRUE);

CREATE INDEX idx_inventory_levels_location_id ON inventory_levels(location_id);
CREATE INDEX idx_inventory_movements_variant_created
  ON inventory_movements(variant_id, created_at DESC);
CREATE INDEX idx_inventory_movements_location_created
  ON inventory_movements(location_id, created_at DESC);
CREATE INDEX idx_inventory_movements_actor_id ON inventory_movements(actor_id);

-- Down Migration
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS inventory_levels;
DROP TABLE IF EXISTS inventory_locations;
