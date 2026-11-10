import { Router } from "express";
import { checkDatabaseConnection } from "../../database/connection/pool.js";
import { sendSuccess } from "../../shared/http.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await checkDatabaseConnection();
    sendSuccess(res, {
      status: "ok" as const,
      service: "wastro-admin-server",
      database: "up" as const,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed", error);
    res.status(503).json({
      data: {
        status: "degraded",
        service: "wastro-admin-server",
        database: "down",
        timestamp: new Date().toISOString(),
      },
    });
  }
});
