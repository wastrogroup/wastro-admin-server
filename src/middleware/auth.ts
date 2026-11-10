import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { findUserById, getUserPermissions, getUserRoles } from "../modules/auth/auth.repository.js";
import { ForbiddenError, UnauthorizedError } from "../shared/errors.js";

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.session.userId;
    const createdAt = req.session.createdAt;
    const lastSeenAt = req.session.lastSeenAt;

    if (!userId || !createdAt || !lastSeenAt) {
      throw new UnauthorizedError();
    }

    const now = Date.now();
    if (now - createdAt > env.SESSION_ABSOLUTE_MS) {
      await destroySession(req);
      throw new UnauthorizedError("Session expired");
    }

    if (now - lastSeenAt > env.SESSION_IDLE_MS) {
      await destroySession(req);
      throw new UnauthorizedError("Session expired due to inactivity");
    }

    const user = await findUserById(userId);
    if (!user || !user.is_active) {
      await destroySession(req);
      throw new UnauthorizedError("Account is inactive or not found");
    }

    const [roles, permissions] = await Promise.all([
      getUserRoles(user.id),
      getUserPermissions(user.id),
    ]);

    req.session.lastSeenAt = now;
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.is_active,
    };
    req.permissions = permissions;

    // Attach roles for potential future use without changing response contracts yet
    void roles;

    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !req.permissions) {
      next(new UnauthorizedError());
      return;
    }

    const missing = required.filter((key) => !req.permissions?.includes(key));
    if (missing.length > 0) {
      next(
        new ForbiddenError("Missing required permission", {
          required,
          missing,
        }),
      );
      return;
    }

    next();
  };
}
