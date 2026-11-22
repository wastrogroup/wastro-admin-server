-- Up Migration
-- Single-row storefront settings (shared DB with Website).

CREATE TABLE IF NOT EXISTS site_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (id, maintenance_mode)
VALUES (1, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO permissions (id, key, description) VALUES
  ('22222222-2222-2222-2222-222222222216', 'settings.read', 'View site settings'),
  ('22222222-2222-2222-2222-222222222217', 'settings.write', 'Update site settings')
ON CONFLICT (key) DO NOTHING;

-- super_admin already receives all permissions via CROSS JOIN pattern in rbac seed;
-- re-sync any newly added keys.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.key IN ('settings.read', 'settings.write')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN ('settings.read', 'settings.write')
WHERE r.name = 'store_manager'
ON CONFLICT DO NOTHING;

-- Down Migration
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT id FROM permissions WHERE key IN ('settings.read', 'settings.write')
);

DELETE FROM permissions WHERE key IN ('settings.read', 'settings.write');

DROP TABLE IF EXISTS site_settings;
