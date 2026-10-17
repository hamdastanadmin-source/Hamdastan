/** The general field layout lives in `@/components`; re-exported for the builder's steps. */
export { Field, invalid, NEUTRAL_CHECKBOX, SwitchRow } from '@/components';

/** A motion setting's problems, by its own field, from the errors filed under `path`. */
export function motionErrors(errors: Record<string, string>, path: string): Record<string, string | undefined> {
  const under = (field: string) =>
    Object.entries(errors).find(([key]) => key === `${path}.${field}` || key.startsWith(`${path}.${field}.`))?.[1];
  // A file the library no longer has is filed under the setting itself.
  return {
    assetId: under('assetId') ?? errors[path],
    assetIds: under('assetIds'),
    durationMs: under('durationMs'),
    caption: under('caption'),
  };
}
