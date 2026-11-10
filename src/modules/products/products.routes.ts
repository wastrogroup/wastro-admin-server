import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validateRequest } from "../../middleware/validate.js";
import { buildPaginationMeta, sendSuccess } from "../../shared/http.js";
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateProductSchema,
} from "./products.schemas.js";
import {
  archiveProductService,
  createProductService,
  getProductService,
  listProductsService,
  updateProductService,
} from "./products.service.js";

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get(
  "/",
  requirePermission("products.read"),
  validateRequest({ query: listProductsQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as {
        page: number;
        pageSize: number;
        search: string;
        status: "draft" | "active" | "archived" | "all";
        categoryId?: string;
      };
      const result = await listProductsService(query);
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

productsRouter.get(
  "/:id",
  requirePermission("products.read"),
  validateRequest({ params: productIdParamsSchema }),
  async (req, res, next) => {
    try {
      const product = await getProductService(String(req.params.id));
      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  },
);

productsRouter.post(
  "/",
  requirePermission("products.write"),
  csrfProtection,
  validateRequest({ body: createProductSchema }),
  async (req, res, next) => {
    try {
      const product = await createProductService(req.body);
      sendSuccess(res, product, { statusCode: 201 });
    } catch (error) {
      next(error);
    }
  },
);

productsRouter.patch(
  "/:id",
  requirePermission("products.write"),
  csrfProtection,
  validateRequest({ params: productIdParamsSchema, body: updateProductSchema }),
  async (req, res, next) => {
    try {
      const product = await updateProductService(String(req.params.id), req.body);
      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  },
);

productsRouter.delete(
  "/:id",
  requirePermission("products.write"),
  csrfProtection,
  validateRequest({ params: productIdParamsSchema }),
  async (req, res, next) => {
    try {
      const product = await archiveProductService(String(req.params.id));
      sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  },
);
