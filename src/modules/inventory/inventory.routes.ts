import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validateRequest } from "../../middleware/validate.js";
import { buildPaginationMeta, sendSuccess } from "../../shared/http.js";
import {
  adjustInventorySchema,
  listInventoryQuerySchema,
  listMovementsQuerySchema,
} from "./inventory.schemas.js";
import {
  adjustInventoryService,
  listInventoryService,
  listLocationsService,
  listMovementsService,
} from "./inventory.service.js";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

inventoryRouter.get(
  "/locations",
  requirePermission("inventory.read"),
  async (_req, res, next) => {
    try {
      const locations = await listLocationsService();
      sendSuccess(res, locations);
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.get(
  "/levels",
  requirePermission("inventory.read"),
  validateRequest({ query: listInventoryQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as {
        page: number;
        pageSize: number;
        search: string;
        locationId?: string;
        lowStockOnly: boolean;
      };
      const result = await listInventoryService(query);
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

inventoryRouter.get(
  "/movements",
  requirePermission("inventory.read"),
  validateRequest({ query: listMovementsQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as {
        page: number;
        pageSize: number;
        search: string;
        variantId?: string;
        locationId?: string;
      };
      const result = await listMovementsService(query);
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

inventoryRouter.post(
  "/adjustments",
  requirePermission("inventory.write"),
  csrfProtection,
  validateRequest({ body: adjustInventorySchema }),
  async (req, res, next) => {
    try {
      const result = await adjustInventoryService({
        ...req.body,
        actorId: req.user!.id,
      });
      sendSuccess(res, result, { statusCode: 201 });
    } catch (error) {
      next(error);
    }
  },
);
