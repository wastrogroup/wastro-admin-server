import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { requestLogger } from "./middleware/request-logger.js";
import { sessionMiddleware } from "./middleware/session.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { categoriesRouter } from "./modules/categories/categories.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { metaRouter } from "./modules/meta/meta.routes.js";
import { productsRouter } from "./modules/products/products.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(sessionMiddleware);
  app.use(cookieParser());

  app.get("/", (_req, res) => {
    res.json({
      name: "wastro-admin-server",
      version: "0.6.0",
      docs: [
        "/api/v1/health",
        "/api/v1/auth/csrf",
        "/api/v1/dashboard/summary",
        "/api/v1/categories",
        "/api/v1/products",
        "/api/v1/inventory/levels",
      ],
    });
  });

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/meta", metaRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/categories", categoriesRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/inventory", inventoryRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
