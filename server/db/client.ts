import { serverSupabase } from '../supabase.ts';
import {
  PaginationParams,
  applyOffsetPagination,
  applyRowCeiling,
  applyQueryPagination
} from '../pagination';

export type { PaginationParams };
export { applyOffsetPagination, applyRowCeiling, applyQueryPagination };

export function getSupabase() {
  return serverSupabase;
}

// Safe date normalization helper
export function safeIsoDate(val: any): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}
