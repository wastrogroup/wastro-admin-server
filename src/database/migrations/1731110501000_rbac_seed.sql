-- Up Migration
INSERT INTO roles (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111101', 'super_admin', 'Full administrative access'),
  ('11111111-1111-1111-1111-111111111102', 'store_manager', 'Store operations across catalog, inventory, and orders'),
  ('11111111-1111-1111-1111-111111111103', 'catalog_manager', 'Products, categories, and catalog media'),
  ('11111111-1111-1111-1111-111111111104', 'order_manager', 'Orders, fulfilment, and shipment workflow'),
  ('11111111-1111-1111-1111-111111111105', 'support_staff', 'Limited customer and order visibility for support')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (id, key, description) VALUES
  ('22222222-2222-2222-2222-222222222201', 'users.manage', 'Manage admin users'),
  ('22222222-2222-2222-2222-222222222202', 'roles.manage', 'Manage roles and permissions'),
  ('22222222-2222-2222-2222-222222222203', 'products.read', 'View products'),
  ('22222222-2222-2222-2222-222222222204', 'products.write', 'Create and update products'),
  ('22222222-2222-2222-2222-222222222205', 'categories.read', 'View categories'),
  ('22222222-2222-2222-2222-222222222206', 'categories.write', 'Create and update categories'),
  ('22222222-2222-2222-2222-222222222207', 'inventory.read', 'View inventory'),
  ('22222222-2222-2222-2222-222222222208', 'inventory.write', 'Adjust inventory'),
  ('22222222-2222-2222-2222-222222222209', 'orders.read', 'View orders'),
  ('22222222-2222-2222-2222-222222222210', 'orders.update_status', 'Update order status'),
  ('22222222-2222-2222-2222-222222222211', 'customers.read', 'View customers'),
  ('22222222-2222-2222-2222-222222222212', 'payments.read', 'View payments'),
  ('22222222-2222-2222-2222-222222222213', 'refunds.create', 'Create refunds'),
  ('22222222-2222-2222-2222-222222222214', 'reports.read', 'View reports'),
  ('22222222-2222-2222-2222-222222222215', 'audit.read', 'View audit logs')
ON CONFLICT (key) DO NOTHING;

-- super_admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- store_manager: operational modules, no user/role admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'products.read', 'products.write',
  'categories.read', 'categories.write',
  'inventory.read', 'inventory.write',
  'orders.read', 'orders.update_status',
  'customers.read',
  'payments.read',
  'reports.read'
)
WHERE r.name = 'store_manager'
ON CONFLICT DO NOTHING;

-- catalog_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'products.read', 'products.write',
  'categories.read', 'categories.write',
  'inventory.read'
)
WHERE r.name = 'catalog_manager'
ON CONFLICT DO NOTHING;

-- order_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'orders.read', 'orders.update_status',
  'customers.read',
  'payments.read',
  'inventory.read'
)
WHERE r.name = 'order_manager'
ON CONFLICT DO NOTHING;

-- support_staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'orders.read',
  'customers.read'
)
WHERE r.name = 'support_staff'
ON CONFLICT DO NOTHING;

-- Down Migration
DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE name IN (
    'super_admin', 'store_manager', 'catalog_manager', 'order_manager', 'support_staff'
  )
);

DELETE FROM permissions
WHERE key IN (
  'users.manage', 'roles.manage',
  'products.read', 'products.write',
  'categories.read', 'categories.write',
  'inventory.read', 'inventory.write',
  'orders.read', 'orders.update_status',
  'customers.read',
  'payments.read', 'refunds.create',
  'reports.read', 'audit.read'
);

DELETE FROM roles
WHERE name IN (
  'super_admin', 'store_manager', 'catalog_manager', 'order_manager', 'support_staff'
);
