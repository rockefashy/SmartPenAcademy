import { Response } from 'express';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RangeableQuery<T = any> {
  range(from: number, to: number): T;
}

export const MAX_PAGE_LIMIT = 1000;
export const MAX_ROW_CEILING = 5000;

/**
 * Applies offset pagination (page + limit) to a Rangeable query builder.
 * Defensively clamps:
 * - page >= 1 (non-numeric / 0 / negative normalized to 1)
 * - limit clamped to [1, MAX_PAGE_LIMIT]
 */
export function applyOffsetPagination<Q extends RangeableQuery>(
  query: Q,
  page: number,
  limit: number
): Q {
  const safePage = Math.max(1, Math.floor(Number(page)) || 1);
  const rawLimit = Math.floor(Number(limit)) || 50;
  const safeLimit = Math.max(1, Math.min(rawLimit, MAX_PAGE_LIMIT));

  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  return query.range(from, to);
}

/**
 * Applies a safety row ceiling to a Rangeable query builder (default 0..4999).
 * Used for internal batch maps and unpaginated fetches to bypass PostgREST's 1000-row clamp.
 */
export function applyRowCeiling<Q extends RangeableQuery>(
  query: Q,
  ceiling: number = 4999
): Q {
  const safeCeiling = Math.max(0, Math.min(Math.floor(Number(ceiling)) || 4999, MAX_ROW_CEILING - 1));
  return query.range(0, safeCeiling);
}

/**
 * Adapter helper for endpoints accepting optional PaginationParams.
 * Dispatches to applyOffsetPagination if page & limit are present, otherwise applyRowCeiling.
 */
export function applyQueryPagination<Q extends RangeableQuery>(
  query: Q,
  params?: PaginationParams
): Q {
  if (params && params.page !== undefined && params.limit !== undefined) {
    return applyOffsetPagination(query, params.page, params.limit);
  }
  return applyRowCeiling(query, 4999);
}

/**
 * Standardizes API responses for paginated endpoints.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  params: { page: number; limit: number }
): Response {
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const limit = Math.max(1, Math.min(Math.floor(Number(params.limit)) || 50, MAX_PAGE_LIMIT));
  const safeTotal = Math.max(0, Math.floor(Number(total)) || 0);
  const totalPages = Math.ceil(safeTotal / limit) || 1;

  return res.json({
    data,
    pagination: {
      page,
      limit,
      total: safeTotal,
      totalPages
    }
  });
}
