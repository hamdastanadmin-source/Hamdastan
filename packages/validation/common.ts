/**
 * Validation primitives shared by the front-end forms and the backend
 * `*.schema.ts` files, so a field is validated the same way on both sides.
 */

import { z } from 'zod';

export const idSchema = z.string().min(1, 'شناسه الزامی است');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQueryInput = z.input<typeof paginationQuerySchema>;
export type PaginationQueryOutput = z.output<typeof paginationQuerySchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']).default('asc');
