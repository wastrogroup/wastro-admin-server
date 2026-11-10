import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validateRequest } from "../../middleware/validate.js";
import { buildPaginationMeta, sendSuccess } from "../../shared/http.js";
import {
  categoryIdParamsSchema,
  createCategorySchema,
  listCategoriesQuerySchema,
  updateCategorySchema,
} from "./categories.schemas.js";
import {
  createCategoryService,
  deactivateCategoryService,
  getCategoryService,
  listCategoriesService,
  updateCategoryService,
} from "./categories.service.js";

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

categoriesRouter.get(
  "/",
  requirePermission("categories.read"),
  validateRequest({ query: listCategoriesQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as {
        page: number;
        pageSize: number;
        search: string;
        isActive: "true" | "false" | "all";
      };
      const result = await listCategoriesService(query);
      sendSuccess(res, result.items, {
        meta: {
          pagination: buildPaginationMeta(query.page, query.pageSize, result.total),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

categoriesRouter.get(
  "/:id",
  requirePermission("categories.read"),
  validateRequest({ params: categoryIdParamsSchema }),
  async (req, res, next) => {
    try {
      const category = await getCategoryService(String(req.params.id));
      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  },
);

categoriesRouter.post(
  "/",
  requirePermission("categories.write"),
  csrfProtection,
  validateRequest({ body: createCategorySchema }),
  async (req, res, next) => {
    try {
      const category = await createCategoryService(req.body);
      sendSuccess(res, category, { statusCode: 201 });
    } catch (error) {
      next(error);
    }
  },
);

categoriesRouter.patch(
  "/:id",
  requirePermission("categories.write"),
  csrfProtection,
  validateRequest({ params: categoryIdParamsSchema, body: updateCategorySchema }),
  async (req, res, next) => {
    try {
      const category = await updateCategoryService(String(req.params.id), req.body);
      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  },
);

categoriesRouter.delete(
  "/:id",
  requirePermission("categories.write"),
  csrfProtection,
  validateRequest({ params: categoryIdParamsSchema }),
  async (req, res, next) => {
    try {
      const category = await deactivateCategoryService(String(req.params.id));
      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  },
);
