import { Router } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { csrfProtection } from "../../middleware/csrf.js";
import { validateRequest } from "../../middleware/validate.js";
import { sendSuccess } from "../../shared/http.js";
import { updateSettingsSchema } from "./settings.schemas.js";
import { getSettingsService, updateSettingsService } from "./settings.service.js";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get("/", requirePermission("settings.read"), async (_req, res, next) => {
  try {
    const settings = await getSettingsService();
    sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch(
  "/",
  requirePermission("settings.write"),
  csrfProtection,
  validateRequest({ body: updateSettingsSchema }),
  async (req, res, next) => {
    try {
      const settings = await updateSettingsService(req.body);
      sendSuccess(res, settings);
    } catch (error) {
      next(error);
    }
  },
);
