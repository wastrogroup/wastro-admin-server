import { pool } from "../../database/connection/pool.js";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  normalized_email: string;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByNormalizedEmail(
  normalizedEmail: string,
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, name, email, normalized_email, password_hash, is_active, created_at, updated_at
     FROM users
     WHERE normalized_email = $1
     LIMIT 1`,
    [normalizedEmail],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, name, email, normalized_email, password_hash, is_active, created_at, updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const result = await pool.query<{ name: string }>(
    `SELECT r.name
     FROM roles r
     INNER JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1
     ORDER BY r.name ASC`,
    [userId],
  );
  return result.rows.map((row) => row.name);
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const result = await pool.query<{ key: string }>(
    `SELECT DISTINCT p.key
     FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     INNER JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1
     ORDER BY p.key ASC`,
    [userId],
  );
  return result.rows.map((row) => row.key);
}

export async function writeAuditLog(input: {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      input.actorId ?? null,
      input.action,
      input.targetType,
      input.targetId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function upsertBootstrapAdmin(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserRow> {
  const normalizedEmail = normalizeEmail(input.email);
  const existing = await findUserByNormalizedEmail(normalizedEmail);

  if (existing) {
    const updated = await pool.query<UserRow>(
      `UPDATE users
       SET name = $1,
           email = $2,
           password_hash = $3,
           is_active = TRUE,
           updated_at = now()
       WHERE id = $4
       RETURNING id, name, email, normalized_email, password_hash, is_active, created_at, updated_at`,
      [input.name, input.email.trim(), input.passwordHash, existing.id],
    );
    return updated.rows[0];
  }

  const created = await pool.query<UserRow>(
    `INSERT INTO users (name, email, normalized_email, password_hash, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING id, name, email, normalized_email, password_hash, is_active, created_at, updated_at`,
    [input.name, input.email.trim(), normalizedEmail, input.passwordHash],
  );
  return created.rows[0];
}

export async function assignRoleByName(userId: string, roleName: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, r.id
     FROM roles r
     WHERE r.name = $2
     ON CONFLICT DO NOTHING`,
    [userId, roleName],
  );
}
