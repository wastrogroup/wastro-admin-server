import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

const moneySchema = z.coerce.number().finite().min(0).max(9999999999.99);

export const listProductsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["draft", "active", "archived", "all"]).optional().default("all"),
  categoryId: z.string().uuid().optional(),
});

export const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(64),
  price: moneySchema,
  compareAtPrice: moneySchema.nullable().optional(),
  currency: z.string().trim().length(3).optional().default("INR"),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const productImageSchema = z.object({
  id: z.string().uuid().optional(),
  storageKey: z.string().trim().min(1).max(500),
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  variantId: z.string().uuid().nullable().optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional().default("draft"),
  variants: z.array(productVariantSchema).min(1),
  images: z.array(productImageSchema).optional().default([]),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  variants: z.array(productVariantSchema).min(1).optional(),
  images: z.array(productImageSchema).optional(),
});

export const productIdParamsSchema = z.object({
  id: z.string().uuid(),
});
