import { pool } from "../../database/connection/pool.js";

export type DashboardSummary = {
  productsActive: number | null;
  productsDraft: number | null;
  categoriesActive: number | null;
  ordersPending: number | null;
  ordersToday: number | null;
  customersTotal: number | null;
  lowStockVariants: number | null;
};

const LOW_STOCK_THRESHOLD = 5;

export async function getDashboardSummary(permissions: string[]): Promise<DashboardSummary> {
  const canProducts = permissions.includes("products.read");
  const canCategories = permissions.includes("categories.read");
  const canOrders = permissions.includes("orders.read");
  const canCustomers = permissions.includes("customers.read");
  const canInventory = permissions.includes("inventory.read");

  const [
    productsActive,
    productsDraft,
    categoriesActive,
    ordersPending,
    ordersToday,
    customersTotal,
    lowStockVariants,
  ] = await Promise.all([
    canProducts
      ? count(`SELECT COUNT(*)::int AS count FROM products WHERE status = 'active'`)
      : Promise.resolve(null),
    canProducts
      ? count(`SELECT COUNT(*)::int AS count FROM products WHERE status = 'draft'`)
      : Promise.resolve(null),
    canCategories
      ? count(`SELECT COUNT(*)::int AS count FROM categories WHERE is_active = TRUE`)
      : Promise.resolve(null),
    canOrders
      ? count(`SELECT COUNT(*)::int AS count FROM orders WHERE status = 'pending'`)
      : Promise.resolve(null),
    canOrders
      ? count(
          `SELECT COUNT(*)::int AS count
           FROM orders
           WHERE placed_at >= date_trunc('day', now())`,
        )
      : Promise.resolve(null),
    canCustomers
      ? count(`SELECT COUNT(*)::int AS count FROM customers`)
      : Promise.resolve(null),
    canInventory
      ? count(
          `SELECT COUNT(*)::int AS count
           FROM inventory_levels
           WHERE (quantity_on_hand - quantity_reserved) <= $1`,
          [LOW_STOCK_THRESHOLD],
        )
      : Promise.resolve(null),
  ]);

  return {
    productsActive,
    productsDraft,
    categoriesActive,
    ordersPending,
    ordersToday,
    customersTotal,
    lowStockVariants,
  };
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query<{ count: number }>(sql, params);
  return result.rows[0]?.count ?? 0;
}
