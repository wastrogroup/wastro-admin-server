import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors.js";
import { formatZodError } from "./validate.js";
import { NotFoundError } from "../shared/errors.js";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError("Route not found"));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? "unknown";

  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = formatZodError(err);
  } else {
    appError = new AppError("Internal server error", {
      statusCode: 500,
      code: "INTERNAL_ERROR",
      isOperational: false,
      cause: err,
    });
  }

  if (!appError.isOperational || appError.statusCode >= 500) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "request_error",
        requestId,
        code: appError.code,
        message: appError.message,
        stack: env.NODE_ENV === "production" ? undefined : appError.stack,
        cause:
          env.NODE_ENV === "production"
            ? undefined
            : err instanceof Error
              ? err.message
              : undefined,
      }),
    );
  }

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
    requestId,
  });
}
