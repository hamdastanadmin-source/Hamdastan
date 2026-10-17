'use client';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { AudienceField } from './AudienceField';

/**
 * Step 4: who sees the activity. Interest categories from onboarding are
 * the product's only groups today; an event's participants are not an
 * audience yet. The count is the API's, for the audience as it stands now.
 */
export function AudienceStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, update, errors } = editor;
  return (
    <AudienceField
      value={state.audience}
      onChange={(audience) => update({ audience })}
      errors={errors}
      extraKinds={['شرکت‌کنندگان رویداد (به‌زودی)']}
    />
  );
}
