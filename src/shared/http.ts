import type { Response } from "express";

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SuccessMeta = {
  pagination?: PaginationMeta;
  [key: string]: unknown;
};

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { statusCode?: number; meta?: SuccessMeta } = {},
): void {
  const body: { data: T; meta?: SuccessMeta } = { data };
  if (options.meta) {
    body.meta = options.meta;
  }
  res.status(options.statusCode ?? 200).json(body);
}
