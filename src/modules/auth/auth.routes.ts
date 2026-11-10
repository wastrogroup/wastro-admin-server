import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { csrfProtection, issueCsrfToken } from "../../middleware/csrf.js";
import { validateRequest } from "../../middleware/validate.js";
import { sendSuccess } from "../../shared/http.js";
import { loginBodySchema } from "./auth.schemas.js";
import { getCurrentUser, login, logout } from "./auth.service.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many login attempts. Try again later.",
      },
      requestId: req.requestId,
    });
  },
});

authRouter.get("/csrf", (req, res, next) => {
  // Persist an anonymous session so CSRF tokens bind to a stable session id.
  req.session.csrfIssuedAt = Date.now();
  req.session.save((error) => {
    if (error) {
      next(error);
      return;
    }
    const csrfToken = issueCsrfToken(req, res);
    sendSuccess(res, { csrfToken });
  });
});

authRouter.post(
  "/login",
  loginLimiter,
  csrfProtection,
  validateRequest({ body: loginBodySchema }),
  async (req, res, next) => {
    try {
      const profile = await login(req, req.body.email, req.body.password);
      const csrfToken = issueCsrfToken(req, res);
      sendSuccess(res, { user: profile, csrfToken });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/logout", requireAuth, csrfProtection, async (req, res, next) => {
  try {
    await logout(req);
    res.clearCookie("wastro.sid");
    sendSuccess(res, { ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const profile = await getCurrentUser(req.user!.id);
    sendSuccess(res, { user: profile });
  } catch (error) {
    next(error);
  }
});

// Permission middleware smoke endpoint for Phase 03 verification
authRouter.get(
  "/permission-check",
  requireAuth,
  requirePermission("users.manage"),
  (_req, res) => {
    sendSuccess(res, { ok: true, required: "users.manage" });
  },
);
