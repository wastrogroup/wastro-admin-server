import { findCategoryById } from "../categories/categories.repository.js";
import { withTransaction } from "../../database/connection/pool.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { slugify } from "../../shared/slug.js";
import {
  createProduct,
  findProductById,
  findProductBySlug,
  findVariantSkuConflict,
  listImagesByProductIds,
  listProducts,
  listVariantsByProductIds,
  replaceImages,
  replaceVariants,
  updateProductRow,
  type ImageRow,
  type ProductRow,
  type VariantRow,
} from "./products.repository.js";

export type ProductDto = {
  id: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
  variants: Array<{
    id: string;
    sku: string;
    price: number;
    compareAtPrice: number | null;
    currency: string;
    attributes: Record<string, unknown>;
  }>;
  images: Array<{
    id: string;
    storageKey: string;
    sortOrder: number;
    variantId: string | null;
  }>;
};

function mapVariant(row: VariantRow) {
  return {
    id: row.id,
    sku: row.sku,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price === null ? null : Number(row.compare_at_price),
    currency: row.currency,
    attributes: row.attributes ?? {},
  };
}

function mapImage(row: ImageRow) {
  return {
    id: row.id,
    storageKey: row.storage_key,
    sortOrder: row.sort_order,
    variantId: row.variant_id,
  };
}

function toDto(product: ProductRow, variants: VariantRow[], images: ImageRow[]): ProductDto {
  return {
    id: product.id,
    categoryId: product.category_id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    status: product.status,
    createdAt: product.created_at.toISOString(),
    updatedAt: product.updated_at.toISOString(),
    variants: variants.map(mapVariant),
    images: images.map(mapImage),
  };
}

async function hydrateProducts(products: ProductRow[]): Promise<ProductDto[]> {
  const ids = products.map((product) => product.id);
  const [variants, images] = await Promise.all([
    listVariantsByProductIds(ids),
    listImagesByProductIds(ids),
  ]);

  return products.map((product) =>
    toDto(
      product,
      variants.filter((variant) => variant.product_id === product.id),
      images.filter((image) => image.product_id === product.id),
    ),
  );
}

async function assertCategory(categoryId: string | null | undefined) {
  if (!categoryId) return;
  const category = await findCategoryById(categoryId);
  if (!category) {
    throw new ValidationError("Category not found");
  }
}

async function assertUniqueSkus(
  variants: Array<{ sku: string }>,
  excludeProductId?: string,
) {
  const seen = new Set<string>();
  for (const variant of variants) {
    const sku = variant.sku.trim().toUpperCase();
    if (seen.has(sku)) {
      throw new ValidationError("Duplicate SKU in request", { sku });
    }
    seen.add(sku);
    const conflict = await findVariantSkuConflict(sku, excludeProductId);
    if (conflict) {
      throw new ConflictError("SKU already exists", { sku });
    }
  }
}

export async function listProductsService(input: {
  page: number;
  pageSize: number;
  search: string;
  status: "draft" | "active" | "archived" | "all";
  categoryId?: string;
}) {
  const { rows, total } = await listProducts({
    search: input.search,
    status: input.status,
    categoryId: input.categoryId,
    limit: input.pageSize,
    offset: (input.page - 1) * input.pageSize,
  });
  return { items: await hydrateProducts(rows), total };
}

export async function getProductService(id: string) {
  const product = await findProductById(id);
  if (!product) {
    throw new NotFoundError("Product not found");
  }
  const [hydrated] = await hydrateProducts([product]);
  return hydrated;
}

export async function createProductService(input: {
  name: string;
  slug?: string;
  description?: string | null;
  categoryId?: string | null;
  status?: "draft" | "active" | "archived";
  variants: Array<{
    sku: string;
    price: number;
    compareAtPrice?: number | null;
    currency?: string;
    attributes?: Record<string, unknown>;
  }>;
  images?: Array<{
    storageKey: string;
    sortOrder?: number;
    variantId?: string | null;
  }>;
}) {
  const slug = slugify(input.slug || input.name);
  if (!slug) {
    throw new ValidationError("Slug could not be generated from name");
  }

  await assertCategory(input.categoryId ?? null);
  await assertUniqueSkus(input.variants);

  const existing = await findProductBySlug(slug);
  if (existing) {
    throw new ConflictError("Product slug already exists");
  }

  return withTransaction(async (client) => {
    const product = await createProduct(
      {
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        status: input.status ?? "draft",
      },
      client,
    );

    const variants = await replaceVariants(
      product.id,
      input.variants.map((variant) => ({
        sku: variant.sku.trim().toUpperCase(),
        price: variant.price,
        compareAtPrice: variant.compareAtPrice ?? null,
        currency: (variant.currency ?? "INR").toUpperCase(),
        attributes: variant.attributes ?? {},
      })),
      client,
    );

    const images = await replaceImages(
      product.id,
      (input.images ?? []).map((image, index) => ({
        storageKey: image.storageKey.trim(),
        sortOrder: image.sortOrder ?? index,
        variantId: image.variantId ?? null,
      })),
      client,
    );

    return toDto(product, variants, images);
  });
}

export async function updateProductService(
  id: string,
  input: {
    name?: string;
    slug?: string;
    description?: string | null;
    categoryId?: string | null;
    status?: "draft" | "active" | "archived";
    variants?: Array<{
      sku: string;
      price: number;
      compareAtPrice?: number | null;
      currency?: string;
      attributes?: Record<string, unknown>;
    }>;
    images?: Array<{
      storageKey: string;
      sortOrder?: number;
      variantId?: string | null;
    }>;
  },
) {
  const current = await findProductById(id);
  if (!current) {
    throw new NotFoundError("Product not found");
  }

  if (Object.prototype.hasOwnProperty.call(input, "categoryId")) {
    await assertCategory(input.categoryId ?? null);
  }

  const nextSlug = input.slug
    ? slugify(input.slug)
    : input.name
      ? slugify(input.name)
      : undefined;

  if (nextSlug === "") {
    throw new ValidationError("Slug could not be generated");
  }

  if (nextSlug) {
    const existing = await findProductBySlug(nextSlug, id);
    if (existing) {
      throw new ConflictError("Product slug already exists");
    }
  }

  if (input.variants) {
    await assertUniqueSkus(input.variants, id);
  }

  return withTransaction(async (client) => {
    const product = await updateProductRow(
      id,
      {
        name: input.name?.trim(),
        slug: nextSlug,
        description: input.description,
        categoryId: input.categoryId,
        status: input.status,
      },
      client,
    );

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    let variants = await listVariantsByProductIds([id], client);
    if (input.variants) {
      variants = await replaceVariants(
        id,
        input.variants.map((variant) => ({
          sku: variant.sku.trim().toUpperCase(),
          price: variant.price,
          compareAtPrice: variant.compareAtPrice ?? null,
          currency: (variant.currency ?? "INR").toUpperCase(),
          attributes: variant.attributes ?? {},
        })),
        client,
      );
    }

    let images = await listImagesByProductIds([id], client);
    if (input.images) {
      images = await replaceImages(
        id,
        input.images.map((image, index) => ({
          storageKey: image.storageKey.trim(),
          sortOrder: image.sortOrder ?? index,
          variantId: image.variantId ?? null,
        })),
        client,
      );
    }

    return toDto(product, variants, images);
  });
}

export async function archiveProductService(id: string) {
  return updateProductService(id, { status: "archived" });
}
