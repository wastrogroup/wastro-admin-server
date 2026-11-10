import type { PoolClient } from "pg";
import { pool } from "../../database/connection/pool.js";

export type ProductRow = {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  created_at: Date;
  updated_at: Date;
};

export type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
  attributes: Record<string, unknown>;
  price: string;
  compare_at_price: string | null;
  currency: string;
  created_at: Date;
  updated_at: Date;
};

export type ImageRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  storage_key: string;
  sort_order: number;
  created_at: Date;
};

type Db = PoolClient | typeof pool;

export async function listProducts(input: {
  search: string;
  status: "draft" | "active" | "archived" | "all";
  categoryId?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: ProductRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (input.search) {
    params.push(`%${input.search}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length})`);
  }
  if (input.status !== "all") {
    params.push(input.status);
    where.push(`p.status = $${params.length}`);
  }
  if (input.categoryId) {
    params.push(input.categoryId);
    where.push(`p.category_id = $${params.length}`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const totalResult = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM products p ${whereSql}`,
    params,
  );

  params.push(input.limit, input.offset);
  const rowsResult = await pool.query<ProductRow>(
    `SELECT p.id, p.category_id, p.name, p.slug, p.description, p.status, p.created_at, p.updated_at
     FROM products p
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0]?.count ?? 0 };
}

export async function findProductById(id: string, db: Db = pool): Promise<ProductRow | null> {
  const result = await db.query<ProductRow>(
    `SELECT id, category_id, name, slug, description, status, created_at, updated_at
     FROM products WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findProductBySlug(
  slug: string,
  excludeId?: string,
  db: Db = pool,
): Promise<ProductRow | null> {
  const result = excludeId
    ? await db.query<ProductRow>(
        `SELECT id, category_id, name, slug, description, status, created_at, updated_at
         FROM products WHERE slug = $1 AND id <> $2`,
        [slug, excludeId],
      )
    : await db.query<ProductRow>(
        `SELECT id, category_id, name, slug, description, status, created_at, updated_at
         FROM products WHERE slug = $1`,
        [slug],
      );
  return result.rows[0] ?? null;
}

export async function listVariantsByProductIds(
  productIds: string[],
  db: Db = pool,
): Promise<VariantRow[]> {
  if (productIds.length === 0) return [];
  const result = await db.query<VariantRow>(
    `SELECT id, product_id, sku, attributes, price::text, compare_at_price::text, currency, created_at, updated_at
     FROM product_variants
     WHERE product_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [productIds],
  );
  return result.rows;
}

export async function listImagesByProductIds(
  productIds: string[],
  db: Db = pool,
): Promise<ImageRow[]> {
  if (productIds.length === 0) return [];
  const result = await db.query<ImageRow>(
    `SELECT id, product_id, variant_id, storage_key, sort_order, created_at
     FROM product_images
     WHERE product_id = ANY($1::uuid[])
     ORDER BY sort_order ASC, created_at ASC`,
    [productIds],
  );
  return result.rows;
}

export async function createProduct(
  input: {
    name: string;
    slug: string;
    description: string | null;
    categoryId: string | null;
    status: "draft" | "active" | "archived";
  },
  db: PoolClient,
): Promise<ProductRow> {
  const result = await db.query<ProductRow>(
    `INSERT INTO products (name, slug, description, category_id, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, category_id, name, slug, description, status, created_at, updated_at`,
    [input.name, input.slug, input.description, input.categoryId, input.status],
  );
  return result.rows[0];
}

export async function updateProductRow(
  id: string,
  input: {
    name?: string;
    slug?: string;
    description?: string | null;
    categoryId?: string | null;
    status?: "draft" | "active" | "archived";
  },
  db: PoolClient,
): Promise<ProductRow | null> {
  const result = await db.query<ProductRow>(
    `UPDATE products
     SET
       name = COALESCE($2, name),
       slug = COALESCE($3, slug),
       description = CASE WHEN $4::boolean THEN $5 ELSE description END,
       category_id = CASE WHEN $6::boolean THEN $7::uuid ELSE category_id END,
       status = COALESCE($8, status),
       updated_at = now()
     WHERE id = $1
     RETURNING id, category_id, name, slug, description, status, created_at, updated_at`,
    [
      id,
      input.name ?? null,
      input.slug ?? null,
      Object.prototype.hasOwnProperty.call(input, "description"),
      input.description ?? null,
      Object.prototype.hasOwnProperty.call(input, "categoryId"),
      input.categoryId ?? null,
      input.status ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function replaceVariants(
  productId: string,
  variants: Array<{
    sku: string;
    price: number;
    compareAtPrice: number | null;
    currency: string;
    attributes: Record<string, unknown>;
  }>,
  db: PoolClient,
): Promise<VariantRow[]> {
  await db.query(`DELETE FROM product_variants WHERE product_id = $1`, [productId]);
  const created: VariantRow[] = [];
  for (const variant of variants) {
    const result = await db.query<VariantRow>(
      `INSERT INTO product_variants (product_id, sku, attributes, price, compare_at_price, currency)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       RETURNING id, product_id, sku, attributes, price::text, compare_at_price::text, currency, created_at, updated_at`,
      [
        productId,
        variant.sku,
        JSON.stringify(variant.attributes),
        variant.price,
        variant.compareAtPrice,
        variant.currency.toUpperCase(),
      ],
    );
    created.push(result.rows[0]);
  }
  return created;
}

export async function replaceImages(
  productId: string,
  images: Array<{
    storageKey: string;
    sortOrder: number;
    variantId: string | null;
  }>,
  db: PoolClient,
): Promise<ImageRow[]> {
  await db.query(`DELETE FROM product_images WHERE product_id = $1`, [productId]);
  const created: ImageRow[] = [];
  for (const image of images) {
    const result = await db.query<ImageRow>(
      `INSERT INTO product_images (product_id, variant_id, storage_key, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, product_id, variant_id, storage_key, sort_order, created_at`,
      [productId, image.variantId, image.storageKey, image.sortOrder],
    );
    created.push(result.rows[0]);
  }
  return created;
}

export async function findVariantSkuConflict(
  sku: string,
  excludeProductId?: string,
  db: Db = pool,
): Promise<boolean> {
  const result = excludeProductId
    ? await db.query(
        `SELECT 1 FROM product_variants WHERE sku = $1 AND product_id <> $2 LIMIT 1`,
        [sku, excludeProductId],
      )
    : await db.query(`SELECT 1 FROM product_variants WHERE sku = $1 LIMIT 1`, [sku]);
  return (result.rowCount ?? 0) > 0;
}
