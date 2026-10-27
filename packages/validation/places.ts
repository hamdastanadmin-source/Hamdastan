/**
 * Places' rules, written once: the admin panel and the `places` module both
 * parse a place with these schemas, and both ask `placePublishProblems`
 * whether it may be published. Whether a reference resolves — a parent, an
 * image, a task, a child being pinned — is the API's to check.
 */

import { PLACE_LIMITS as L } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { PlaceInput } from '@hamdastan/types';

import { z } from 'zod';

import { line, uniqueIdsSchema, uuidSchema } from './common';
import { mediaIdSchema } from './media';

const fa = (n: number) => toPersianDigits(n);

const percent = z.number().min(0).max(100);

const name = line(L.NAME_MAX, 'نام مکان را وارد کنید');

/** `POST /admin/places`. */
export const placeCreateSchema = z.object({ worldId: z.uuid({ error: 'جهان را انتخاب کنید' }), parentId: uuidSchema.nullable(), name });

/** `PUT /admin/places/:id`. */
export const placeInputSchema = z.object({
  name,
  summary: line(L.SUMMARY_MAX, null),
  imageId: mediaIdSchema.nullable(),
  activityIds: uniqueIdsSchema(L.ACTIVITIES_MAX, 'تسک'),
  pins: z
    .array(z.object({ id: uuidSchema, x: percent, y: percent }))
    .max(L.CHILDREN_MAX, { error: `حداکثر ${fa(L.CHILDREN_MAX)} مکان روی یک تصویر` }),
});

export const placeStatusSchema = z.object({ action: z.enum(['publish', 'unpublish']) });

/** What a place needs before people may see it. Empty when it may be published. */
export function placePublishProblems(input: Pick<PlaceInput, 'name' | 'imageId'>): { field: string; message: string }[] {
  const problems: { field: string; message: string }[] = [];
  if (!input.name.trim()) problems.push({ field: 'name', message: 'نام مکان را وارد کنید' });
  if (!input.imageId) problems.push({ field: 'imageId', message: 'پیش از انتشار، تصویر مکان را انتخاب کنید' });
  return problems;
}

export type PlaceInputOutput = z.output<typeof placeInputSchema>;
export type PlaceCreateOutput = z.output<typeof placeCreateSchema>;
