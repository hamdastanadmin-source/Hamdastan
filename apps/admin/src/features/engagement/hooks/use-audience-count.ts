'use client';

import { useEffect, useState } from 'react';

import type { ActivityAudience } from '@hamdastan/types';
import { activityAudienceSchema } from '@hamdastan/validation';

import { adminEngagementService } from '@/services';

const DEBOUNCE_MS = 500;

/**
 * How many active people an audience covers, asked of the API while the
 * admin edits it. Null while the audience is incomplete or the answer is on
 * its way; the count is the server's, never worked out here.
 */
export function useAudienceCount(audience: ActivityAudience): number | null {
  const [answer, setAnswer] = useState<{ key: string; eligible: number } | null>(null);
  const key = JSON.stringify(audience);

  useEffect(() => {
    const parsed = activityAudienceSchema.safeParse(audience);
    if (!parsed.success) return;
    let active = true;
    const timer = setTimeout(() => {
      adminEngagementService.previewAudience(parsed.data).then(
        ({ eligible }) => active && setAnswer({ key, eligible }),
        () => undefined
      );
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // `key` stands for `audience`: a new object with the same content is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return answer?.key === key ? answer.eligible : null;
}
