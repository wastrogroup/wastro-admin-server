import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

export const listCategoriesQuerySchema = paginationQuerySchema.extend({
  isActive: z
    .enum(["true", "false", "all"])
    .optional()
    .default("all"),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const categoryIdParamsSchema = z.object({
  id: z.string().uuid(),
});
