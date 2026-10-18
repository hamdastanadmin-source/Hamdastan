'use client';

import { useEffect, useState } from 'react';

import type { AudienceEstimate, CampaignCategory, NotificationAudience, NotificationDestination } from '@hamdastan/types';
import { notificationAudienceSchema } from '@hamdastan/validation';

import { adminNotificationsService } from '@/services';

const DEBOUNCE_MS = 400;

/**
 * How many people a campaign would reach today, counted by the API with the
 * same rule the dispatcher sends with — preferences and destination access
 * included. Null while counting, or while the audience is still incomplete.
 */
export function useAudienceEstimate(audience: NotificationAudience, category: CampaignCategory, destination: NotificationDestination) {
  const [estimate, setEstimate] = useState<{ key: string; value: AudienceEstimate | null } | null>(null);
  const key = JSON.stringify({ audience, category, destination });

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!notificationAudienceSchema.safeParse(audience).success) {
        if (active) setEstimate({ key, value: null });
        return;
      }
      adminNotificationsService.estimate({ audience, category, destination }).then(
        (value) => active && setEstimate({ key, value }),
        () => active && setEstimate({ key, value: null })
      );
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key, audience, category, destination]);

  return estimate?.key === key ? estimate.value : null;
}
