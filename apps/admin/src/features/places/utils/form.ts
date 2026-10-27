import type { UseFormReturn } from 'react-hook-form';

import type { AdminPlaceDetail, PlaceInput } from '@hamdastan/types';
import type { PlaceInputOutput, placeInputSchema, z } from '@hamdastan/validation';

/** What the editor's form holds: the place as the panel saves it. */
export type PlaceFormInput = z.input<typeof placeInputSchema>;

/** The one form the editor's sections share; saved together. */
export type PlaceForm = UseFormReturn<PlaceFormInput, unknown, PlaceInputOutput>;

export const toForm = (place: AdminPlaceDetail): PlaceInput => ({
  name: place.name,
  summary: place.summary,
  imageId: place.imageId,
  activityIds: [...place.activityIds],
  pins: place.children.map((child) => ({ id: child.id, ...child.pin })),
});
