import { pool } from "../../database/connection/pool.js";

export type SiteSettingsRow = {
  maintenance_mode: boolean;
  updated_at: Date;
};

export async function getSiteSettings(): Promise<SiteSettingsRow> {
  const result = await pool.query<SiteSettingsRow>(
    `SELECT maintenance_mode, updated_at
     FROM site_settings
     WHERE id = 1`,
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  const inserted = await pool.query<SiteSettingsRow>(
    `INSERT INTO site_settings (id, maintenance_mode)
     VALUES (1, TRUE)
     ON CONFLICT (id) DO UPDATE SET updated_at = now()
     RETURNING maintenance_mode, updated_at`,
  );
  return inserted.rows[0];
}

export async function updateSiteSettings(input: {
  maintenanceMode: boolean;
}): Promise<SiteSettingsRow> {
  const result = await pool.query<SiteSettingsRow>(
    `INSERT INTO site_settings (id, maintenance_mode, updated_at)
     VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE
       SET maintenance_mode = EXCLUDED.maintenance_mode,
           updated_at = now()
     RETURNING maintenance_mode, updated_at`,
    [input.maintenanceMode],
  );
  return result.rows[0];
}
