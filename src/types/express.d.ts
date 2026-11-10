import "express-serve-static-core";
import "express-session";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
};

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
    user?: AuthUser;
    permissions?: string[];
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    createdAt?: number;
    lastSeenAt?: number;
    csrfIssuedAt?: number;
  }
}
