import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { slugify } from "../../shared/slug.js";
import {
  createCategory,
  findCategoryById,
  findCategoryBySlug,
  listCategories,
  softDisableCategory,
  updateCategory,
  type CategoryRow,
} from "./categories.repository.js";

export type CategoryDto = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toDto(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listCategoriesService(input: {
  page: number;
  pageSize: number;
  search: string;
  isActive: "true" | "false" | "all";
}) {
  const { rows, total } = await listCategories({
    search: input.search,
    isActive: input.isActive,
    limit: input.pageSize,
    offset: (input.page - 1) * input.pageSize,
  });
  return { items: rows.map(toDto), total };
}

export async function getCategoryService(id: string) {
  const row = await findCategoryById(id);
  if (!row) {
    throw new NotFoundError("Category not found");
  }
  return toDto(row);
}

export async function createCategoryService(input: {
  name: string;
  slug?: string;
  parentId?: string | null;
  isActive?: boolean;
}) {
  const slug = slugify(input.slug || input.name);
  if (!slug) {
    throw new ValidationError("Slug could not be generated from name");
  }

  if (input.parentId) {
    const parent = await findCategoryById(input.parentId);
    if (!parent) {
      throw new ValidationError("Parent category not found");
    }
  }

  const existing = await findCategoryBySlug(slug);
  if (existing) {
    throw new ConflictError("Category slug already exists");
  }

  const row = await createCategory({
    name: input.name.trim(),
    slug,
    parentId: input.parentId ?? null,
    isActive: input.isActive ?? true,
  });
  return toDto(row);
}

export async function updateCategoryService(
  id: string,
  input: {
    name?: string;
    slug?: string;
    parentId?: string | null;
    isActive?: boolean;
  },
) {
  const current = await findCategoryById(id);
  if (!current) {
    throw new NotFoundError("Category not found");
  }

  if (input.parentId === id) {
    throw new ValidationError("Category cannot be its own parent");
  }

  if (input.parentId) {
    const parent = await findCategoryById(input.parentId);
    if (!parent) {
      throw new ValidationError("Parent category not found");
    }
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
    const existing = await findCategoryBySlug(nextSlug, id);
    if (existing) {
      throw new ConflictError("Category slug already exists");
    }
  }

  const row = await updateCategory(id, {
    name: input.name?.trim(),
    slug: nextSlug,
    parentId: input.parentId,
    isActive: input.isActive,
  });

  if (!row) {
    throw new NotFoundError("Category not found");
  }

  return toDto(row);
}

export async function deactivateCategoryService(id: string) {
  const row = await softDisableCategory(id);
  if (!row) {
    throw new NotFoundError("Category not found");
  }
  return toDto(row);
}
