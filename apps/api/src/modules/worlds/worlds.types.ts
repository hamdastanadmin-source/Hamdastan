/**
 * Types internal to the Worlds module. The wire shapes are `World` and
 * `AdminWorld` in `@hamdastan/types`.
 */

export type WorldFields = {
  slug: string;
  name: string;
  summary: string;
  coverId: string | null;
  isActive: boolean;
};

export type WorldRecord = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  coverId: string | null;
  position: number;
  isActive: boolean;
  eventCount: number;
};
