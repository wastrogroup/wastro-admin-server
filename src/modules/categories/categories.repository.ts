import type { PoolClient } from "pg";
import { pool } from "../../database/connection/pool.js";

export type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type Db = PoolClient | typeof pool;

export async function listCategories(input: {
  search: string;
  isActive: "true" | "false" | "all";
  limit: number;
  offset: number;
}): Promise<{ rows: CategoryRow[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (input.search) {
    params.push(`%${input.search}%`);
    where.push(`(name ILIKE $${params.length} OR slug ILIKE $${params.length})`);
  }

  if (input.isActive === "true") {
    where.push("is_active = TRUE");
  } else if (input.isActive === "false") {
    where.push("is_active = FALSE");
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalResult = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM categories ${whereSql}`,
    params,
  );

  params.push(input.limit, input.offset);
  const rowsResult = await pool.query<CategoryRow>(
    `SELECT id, parent_id, name, slug, is_active, created_at, updated_at
     FROM categories
     ${whereSql}
     ORDER BY name ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0]?.count ?? 0 };
}

export async function findCategoryById(id: string, db: Db = pool): Promise<CategoryRow | null> {
  const result = await db.query<CategoryRow>(
    `SELECT id, parent_id, name, slug, is_active, created_at, updated_at
     FROM categories WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findCategoryBySlug(
  slug: string,
  excludeId?: string,
  db: Db = pool,
): Promise<CategoryRow | null> {
  const result = excludeId
    ? await db.query<CategoryRow>(
        `SELECT id, parent_id, name, slug, is_active, created_at, updated_at
         FROM categories WHERE slug = $1 AND id <> $2`,
        [slug, excludeId],
      )
    : await db.query<CategoryRow>(
        `SELECT id, parent_id, name, slug, is_active, created_at, updated_at
         FROM categories WHERE slug = $1`,
        [slug],
      );
  return result.rows[0] ?? null;
}

export async function createCategory(
  input: {
    name: string;
    slug: string;
    parentId: string | null;
    isActive: boolean;
  },
  db: Db = pool,
): Promise<CategoryRow> {
  const result = await db.query<CategoryRow>(
    `INSERT INTO categories (name, slug, parent_id, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING id, parent_id, name, slug, is_active, created_at, updated_at`,
    [input.name, input.slug, input.parentId, input.isActive],
  );
  return result.rows[0];
}

export async function updateCategory(
  id: string,
  input: {
    name?: string;
    slug?: string;
    parentId?: string | null;
    isActive?: boolean;
  },
  db: Db = pool,
): Promise<CategoryRow | null> {
  const result = await db.query<CategoryRow>(
    `UPDATE categories
     SET
       name = COALESCE($2, name),
       slug = COALESCE($3, slug),
       parent_id = CASE WHEN $4::boolean THEN $5::uuid ELSE parent_id END,
       is_active = COALESCE($6, is_active),
       updated_at = now()
     WHERE id = $1
     RETURNING id, parent_id, name, slug, is_active, created_at, updated_at`,
    [
      id,
      input.name ?? null,
      input.slug ?? null,
      Object.prototype.hasOwnProperty.call(input, "parentId"),
      input.parentId ?? null,
      input.isActive ?? null,
    ],
  );
  return result.rows[0] ?? null;
}

export async function softDisableCategory(id: string): Promise<CategoryRow | null> {
  const result = await pool.query<CategoryRow>(
    `UPDATE categories
     SET is_active = FALSE, updated_at = now()
     WHERE id = $1
     RETURNING id, parent_id, name, slug, is_active, created_at, updated_at`,
    [id],
  );
  return result.rows[0] ?? null;
}
