import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate.js";
import { sendSuccess } from "../../shared/http.js";

export const metaRouter = Router();

const metaQuerySchema = z.object({
  includeTime: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

metaRouter.get(
  "/",
  validateRequest({ query: metaQuerySchema }),
  (req, res) => {
    const includeTime = Boolean(req.query.includeTime);
    sendSuccess(res, {
      apiVersion: "v1",
      requestId: req.requestId,
      ...(includeTime ? { serverTime: new Date().toISOString() } : {}),
    });
  },
);
