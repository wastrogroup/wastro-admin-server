import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

export const listInventoryQuerySchema = paginationQuerySchema.extend({
  locationId: z.string().uuid().optional(),
  lowStockOnly: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
});

export const adjustInventorySchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  delta: z.coerce.number().int().refine((value) => value !== 0, {
    message: "Delta must be non-zero",
  }),
  reason: z.string().trim().min(3).max(200),
  referenceId: z.string().uuid().nullable().optional(),
});

export const listMovementsQuerySchema = paginationQuerySchema.extend({
  variantId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});
