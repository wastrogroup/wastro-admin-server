import type { PoolClient } from "pg";
import { pool } from "../../database/connection/pool.js";

export type LocationRow = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

export type InventoryLevelRow = {
  variant_id: string;
  location_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  updated_at: Date;
  sku: string;
  product_id: string;
  product_name: string;
  location_name: string;
  location_code: string;
};

export type MovementRow = {
  id: string;
  variant_id: string;
  location_id: string;
  delta: number;
  reason: string;
  reference_id: string | null;
  actor_id: string | null;
  created_at: Date;
  sku: string;
  product_name: string;
  location_code: string;
};

type Db = PoolClient | typeof pool;

export async function listLocations(db: Db = pool): Promise<LocationRow[]> {
  const result = await db.query<LocationRow>(
    `SELECT id, name, code, is_active
     FROM inventory_locations
     WHERE is_active = TRUE
     ORDER BY name ASC`,
  );
  return result.rows;
}

export async function findLocationById(
  id: string,
  db: Db = pool,
): Promise<LocationRow | null> {
  const result = await db.query<LocationRow>(
    `SELECT id, name, code, is_active FROM inventory_locations WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findVariantExists(variantId: string, db: Db = pool): Promise<boolean> {
  const result = await db.query(`SELECT 1 FROM product_variants WHERE id = $1`, [variantId]);
  return (result.rowCount ?? 0) > 0;
}

export async function listInventoryLevels(input: {
  search: string;
  locationId?: string;
  lowStockOnly: boolean;
  lowStockThreshold: number;
  limit: number;
  offset: number;
}): Promise<{ rows: InventoryLevelRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (input.search) {
    params.push(`%${input.search}%`);
    where.push(
      `(pv.sku ILIKE $${params.length} OR p.name ILIKE $${params.length})`,
    );
  }
  if (input.locationId) {
    params.push(input.locationId);
    where.push(`il.location_id = $${params.length}`);
  }
  if (input.lowStockOnly) {
    params.push(input.lowStockThreshold);
    where.push(`(il.quantity_on_hand - il.quantity_reserved) <= $${params.length}`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalResult = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM inventory_levels il
     INNER JOIN product_variants pv ON pv.id = il.variant_id
     INNER JOIN products p ON p.id = pv.product_id
     INNER JOIN inventory_locations loc ON loc.id = il.location_id
     ${whereSql}`,
    params,
  );

  params.push(input.limit, input.offset);
  const rowsResult = await pool.query<InventoryLevelRow>(
    `SELECT
       il.variant_id,
       il.location_id,
       il.quantity_on_hand,
       il.quantity_reserved,
       il.updated_at,
       pv.sku,
       p.id AS product_id,
       p.name AS product_name,
       loc.name AS location_name,
       loc.code AS location_code
     FROM inventory_levels il
     INNER JOIN product_variants pv ON pv.id = il.variant_id
     INNER JOIN products p ON p.id = pv.product_id
     INNER JOIN inventory_locations loc ON loc.id = il.location_id
     ${whereSql}
     ORDER BY (il.quantity_on_hand - il.quantity_reserved) ASC, p.name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0]?.count ?? 0 };
}

export async function lockInventoryLevel(
  variantId: string,
  locationId: string,
  db: PoolClient,
): Promise<{ quantity_on_hand: number; quantity_reserved: number } | null> {
  const result = await db.query<{
    quantity_on_hand: number;
    quantity_reserved: number;
  }>(
    `SELECT quantity_on_hand, quantity_reserved
     FROM inventory_levels
     WHERE variant_id = $1 AND location_id = $2
     FOR UPDATE`,
    [variantId, locationId],
  );
  return result.rows[0] ?? null;
}

export async function upsertInventoryLevel(
  input: {
    variantId: string;
    locationId: string;
    quantityOnHand: number;
    quantityReserved: number;
  },
  db: PoolClient,
): Promise<void> {
  await db.query(
    `INSERT INTO inventory_levels (variant_id, location_id, quantity_on_hand, quantity_reserved, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (variant_id, location_id)
     DO UPDATE SET
       quantity_on_hand = EXCLUDED.quantity_on_hand,
       quantity_reserved = EXCLUDED.quantity_reserved,
       updated_at = now()`,
    [input.variantId, input.locationId, input.quantityOnHand, input.quantityReserved],
  );
}

export async function insertMovement(
  input: {
    variantId: string;
    locationId: string;
    delta: number;
    reason: string;
    referenceId?: string | null;
    actorId?: string | null;
  },
  db: PoolClient,
): Promise<MovementRow> {
  const result = await db.query<MovementRow>(
    `WITH inserted AS (
       INSERT INTO inventory_movements (variant_id, location_id, delta, reason, reference_id, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, variant_id, location_id, delta, reason, reference_id, actor_id, created_at
     )
     SELECT
       i.id,
       i.variant_id,
       i.location_id,
       i.delta,
       i.reason,
       i.reference_id,
       i.actor_id,
       i.created_at,
       pv.sku,
       p.name AS product_name,
       loc.code AS location_code
     FROM inserted i
     INNER JOIN product_variants pv ON pv.id = i.variant_id
     INNER JOIN products p ON p.id = pv.product_id
     INNER JOIN inventory_locations loc ON loc.id = i.location_id`,
    [
      input.variantId,
      input.locationId,
      input.delta,
      input.reason,
      input.referenceId ?? null,
      input.actorId ?? null,
    ],
  );
  return result.rows[0];
}

export async function listMovements(input: {
  search: string;
  variantId?: string;
  locationId?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: MovementRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (input.variantId) {
    params.push(input.variantId);
    where.push(`m.variant_id = $${params.length}`);
  }
  if (input.locationId) {
    params.push(input.locationId);
    where.push(`m.location_id = $${params.length}`);
  }
  if (input.search) {
    params.push(`%${input.search}%`);
    where.push(
      `(pv.sku ILIKE $${params.length} OR p.name ILIKE $${params.length} OR m.reason ILIKE $${params.length})`,
    );
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const totalResult = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM inventory_movements m
     INNER JOIN product_variants pv ON pv.id = m.variant_id
     INNER JOIN products p ON p.id = pv.product_id
     ${whereSql}`,
    params,
  );

  params.push(input.limit, input.offset);
  const rowsResult = await pool.query<MovementRow>(
    `SELECT
       m.id,
       m.variant_id,
       m.location_id,
       m.delta,
       m.reason,
       m.reference_id,
       m.actor_id,
       m.created_at,
       pv.sku,
       p.name AS product_name,
       loc.code AS location_code
     FROM inventory_movements m
     INNER JOIN product_variants pv ON pv.id = m.variant_id
     INNER JOIN products p ON p.id = pv.product_id
     INNER JOIN inventory_locations loc ON loc.id = m.location_id
     ${whereSql}
     ORDER BY m.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0]?.count ?? 0 };
}
