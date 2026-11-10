import { withTransaction } from "../../database/connection/pool.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { writeAuditLog } from "../auth/auth.repository.js";
import {
  findLocationById,
  findVariantExists,
  insertMovement,
  listInventoryLevels,
  listLocations,
  listMovements,
  lockInventoryLevel,
  upsertInventoryLevel,
  type InventoryLevelRow,
  type MovementRow,
} from "./inventory.repository.js";

export const LOW_STOCK_THRESHOLD = 5;

/**
 * Order reservation policy (Phase 07 will call these helpers):
 * - place order: reserveStock increases quantity_reserved
 * - cancel/expire: releaseReservation decreases quantity_reserved
 * - ship/fulfil: commitReservation deducts on-hand and reserved together
 */
export type InventoryLevelDto = {
  variantId: string;
  locationId: string;
  sku: string;
  productId: string;
  productName: string;
  locationName: string;
  locationCode: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  isLowStock: boolean;
  updatedAt: string;
};

export type MovementDto = {
  id: string;
  variantId: string;
  locationId: string;
  sku: string;
  productName: string;
  locationCode: string;
  delta: number;
  reason: string;
  referenceId: string | null;
  actorId: string | null;
  createdAt: string;
};

export type LocationDto = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

function toLevelDto(row: InventoryLevelRow): InventoryLevelDto {
  const available = row.quantity_on_hand - row.quantity_reserved;
  return {
    variantId: row.variant_id,
    locationId: row.location_id,
    sku: row.sku,
    productId: row.product_id,
    productName: row.product_name,
    locationName: row.location_name,
    locationCode: row.location_code,
    quantityOnHand: row.quantity_on_hand,
    quantityReserved: row.quantity_reserved,
    quantityAvailable: available,
    isLowStock: available <= LOW_STOCK_THRESHOLD,
    updatedAt: row.updated_at.toISOString(),
  };
}

function toMovementDto(row: MovementRow): MovementDto {
  return {
    id: row.id,
    variantId: row.variant_id,
    locationId: row.location_id,
    sku: row.sku,
    productName: row.product_name,
    locationCode: row.location_code,
    delta: row.delta,
    reason: row.reason,
    referenceId: row.reference_id,
    actorId: row.actor_id,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listLocationsService() {
  const rows = await listLocations();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
  })) satisfies LocationDto[];
}

export async function listInventoryService(input: {
  page: number;
  pageSize: number;
  search: string;
  locationId?: string;
  lowStockOnly: boolean;
}) {
  const { rows, total } = await listInventoryLevels({
    search: input.search,
    locationId: input.locationId,
    lowStockOnly: input.lowStockOnly,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    limit: input.pageSize,
    offset: (input.page - 1) * input.pageSize,
  });
  return { items: rows.map(toLevelDto), total };
}

export async function listMovementsService(input: {
  page: number;
  pageSize: number;
  search: string;
  variantId?: string;
  locationId?: string;
}) {
  const { rows, total } = await listMovements({
    search: input.search,
    variantId: input.variantId,
    locationId: input.locationId,
    limit: input.pageSize,
    offset: (input.page - 1) * input.pageSize,
  });
  return { items: rows.map(toMovementDto), total };
}

export async function adjustInventoryService(input: {
  variantId: string;
  locationId: string;
  delta: number;
  reason: string;
  referenceId?: string | null;
  actorId: string;
}) {
  if (input.delta === 0) {
    throw new ValidationError("Delta must be non-zero");
  }

  const location = await findLocationById(input.locationId);
  if (!location || !location.is_active) {
    throw new NotFoundError("Inventory location not found");
  }

  const variantExists = await findVariantExists(input.variantId);
  if (!variantExists) {
    throw new NotFoundError("Product variant not found");
  }

  const result = await withTransaction(async (client) => {
    const current = await lockInventoryLevel(input.variantId, input.locationId, client);
    const onHand = current?.quantity_on_hand ?? 0;
    const reserved = current?.quantity_reserved ?? 0;
    const nextOnHand = onHand + input.delta;

    if (nextOnHand < 0) {
      throw new ConflictError("Insufficient stock for this adjustment", {
        quantityOnHand: onHand,
        delta: input.delta,
      });
    }

    if (reserved > nextOnHand) {
      throw new ConflictError("Adjustment would leave reserved quantity above on-hand stock", {
        quantityOnHand: nextOnHand,
        quantityReserved: reserved,
      });
    }

    await upsertInventoryLevel(
      {
        variantId: input.variantId,
        locationId: input.locationId,
        quantityOnHand: nextOnHand,
        quantityReserved: reserved,
      },
      client,
    );

    const movement = await insertMovement(
      {
        variantId: input.variantId,
        locationId: input.locationId,
        delta: input.delta,
        reason: input.reason.trim(),
        referenceId: input.referenceId,
        actorId: input.actorId,
      },
      client,
    );

    return {
      movement: toMovementDto(movement),
      quantityOnHand: nextOnHand,
      quantityReserved: reserved,
      quantityAvailable: nextOnHand - reserved,
    };
  });

  await writeAuditLog({
    actorId: input.actorId,
    action: "inventory.adjusted",
    targetType: "product_variant",
    targetId: input.variantId,
    metadata: {
      locationId: input.locationId,
      delta: input.delta,
      reason: input.reason,
      quantityOnHand: result.quantityOnHand,
    },
  });

  return result;
}

export async function reserveStock(input: {
  variantId: string;
  locationId: string;
  quantity: number;
}) {
  if (input.quantity <= 0) {
    throw new ValidationError("Reserve quantity must be positive");
  }

  return withTransaction(async (client) => {
    const current = await lockInventoryLevel(input.variantId, input.locationId, client);
    if (!current) {
      throw new ConflictError("No inventory level exists for this variant/location");
    }

    const available = current.quantity_on_hand - current.quantity_reserved;
    if (available < input.quantity) {
      throw new ConflictError("Insufficient available stock to reserve", {
        available,
        requested: input.quantity,
      });
    }

    const nextReserved = current.quantity_reserved + input.quantity;
    await upsertInventoryLevel(
      {
        variantId: input.variantId,
        locationId: input.locationId,
        quantityOnHand: current.quantity_on_hand,
        quantityReserved: nextReserved,
      },
      client,
    );

    return {
      quantityOnHand: current.quantity_on_hand,
      quantityReserved: nextReserved,
      quantityAvailable: current.quantity_on_hand - nextReserved,
    };
  });
}

export async function releaseReservation(input: {
  variantId: string;
  locationId: string;
  quantity: number;
}) {
  if (input.quantity <= 0) {
    throw new ValidationError("Release quantity must be positive");
  }

  return withTransaction(async (client) => {
    const current = await lockInventoryLevel(input.variantId, input.locationId, client);
    if (!current) {
      throw new ConflictError("No inventory level exists for this variant/location");
    }

    if (current.quantity_reserved < input.quantity) {
      throw new ConflictError("Cannot release more than currently reserved", {
        quantityReserved: current.quantity_reserved,
        requested: input.quantity,
      });
    }

    const nextReserved = current.quantity_reserved - input.quantity;
    await upsertInventoryLevel(
      {
        variantId: input.variantId,
        locationId: input.locationId,
        quantityOnHand: current.quantity_on_hand,
        quantityReserved: nextReserved,
      },
      client,
    );

    return {
      quantityOnHand: current.quantity_on_hand,
      quantityReserved: nextReserved,
      quantityAvailable: current.quantity_on_hand - nextReserved,
    };
  });
}

export async function commitReservation(input: {
  variantId: string;
  locationId: string;
  quantity: number;
  reason?: string;
  referenceId?: string | null;
  actorId?: string | null;
}) {
  if (input.quantity <= 0) {
    throw new ValidationError("Commit quantity must be positive");
  }

  return withTransaction(async (client) => {
    const current = await lockInventoryLevel(input.variantId, input.locationId, client);
    if (!current) {
      throw new ConflictError("No inventory level exists for this variant/location");
    }

    if (current.quantity_reserved < input.quantity || current.quantity_on_hand < input.quantity) {
      throw new ConflictError("Cannot commit reservation with insufficient stock", {
        quantityOnHand: current.quantity_on_hand,
        quantityReserved: current.quantity_reserved,
        requested: input.quantity,
      });
    }

    const nextOnHand = current.quantity_on_hand - input.quantity;
    const nextReserved = current.quantity_reserved - input.quantity;

    await upsertInventoryLevel(
      {
        variantId: input.variantId,
        locationId: input.locationId,
        quantityOnHand: nextOnHand,
        quantityReserved: nextReserved,
      },
      client,
    );

    await insertMovement(
      {
        variantId: input.variantId,
        locationId: input.locationId,
        delta: -input.quantity,
        reason: input.reason ?? "order_fulfilled",
        referenceId: input.referenceId,
        actorId: input.actorId,
      },
      client,
    );

    return {
      quantityOnHand: nextOnHand,
      quantityReserved: nextReserved,
      quantityAvailable: nextOnHand - nextReserved,
    };
  });
}
