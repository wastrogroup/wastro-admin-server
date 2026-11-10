import argon2 from "argon2";
import type { Request } from "express";
import { UnauthorizedError } from "../../shared/errors.js";
import {
  findUserById,
  findUserByNormalizedEmail,
  getUserPermissions,
  getUserRoles,
  normalizeEmail,
  writeAuditLog,
  type UserRow,
} from "./auth.repository.js";

export type AuthProfile = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

const INVALID_CREDENTIALS = "Invalid email or password";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

async function toAuthProfile(user: UserRow): Promise<AuthProfile> {
  const [roles, permissions] = await Promise.all([
    getUserRoles(user.id),
    getUserPermissions(user.id),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles,
    permissions,
  };
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function login(
  req: Request,
  email: string,
  password: string,
): Promise<AuthProfile> {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByNormalizedEmail(normalizedEmail);

  if (!user || !user.is_active) {
    await writeAuditLog({
      action: "auth.login_failed",
      targetType: "user",
      metadata: { email: normalizedEmail, reason: "not_found_or_inactive" },
    });
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    await writeAuditLog({
      actorId: user.id,
      action: "auth.login_failed",
      targetType: "user",
      targetId: user.id,
      metadata: { reason: "invalid_password" },
    });
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  await regenerateSession(req);
  const now = Date.now();
  req.session.userId = user.id;
  req.session.createdAt = now;
  req.session.lastSeenAt = now;
  await saveSession(req);

  await writeAuditLog({
    actorId: user.id,
    action: "auth.login_succeeded",
    targetType: "user",
    targetId: user.id,
  });

  return toAuthProfile(user);
}

export async function logout(req: Request): Promise<void> {
  const userId = req.session.userId;
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  if (userId) {
    await writeAuditLog({
      actorId: userId,
      action: "auth.logout",
      targetType: "user",
      targetId: userId,
    });
  }
}

export async function getCurrentUser(userId: string): Promise<AuthProfile> {
  const user = await findUserById(userId);
  if (!user || !user.is_active) {
    throw new UnauthorizedError("Account is inactive or not found");
  }
  return toAuthProfile(user);
}
