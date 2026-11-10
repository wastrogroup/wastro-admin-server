import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { sendSuccess } from "../../shared/http.js";
import { getDashboardSummary } from "./dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", requireAuth, async (req, res, next) => {
  try {
    const summary = await getDashboardSummary(req.permissions ?? []);
    sendSuccess(res, summary);
  } catch (error) {
    next(error);
  }
});
