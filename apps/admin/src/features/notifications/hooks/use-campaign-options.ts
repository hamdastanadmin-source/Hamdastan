'use client';

import { useEffect, useState } from 'react';

import type { CampaignOptions } from '@hamdastan/types';

import { adminNotificationsService } from '@/services';

/** The events, activities and worlds a campaign may point at or be sent about. Null until read. */
export function useCampaignOptions(): CampaignOptions | null {
  const [options, setOptions] = useState<CampaignOptions | null>(null);
  useEffect(() => {
    let active = true;
    adminNotificationsService.options().then(
      (answer) => active && setOptions(answer),
      () => active && setOptions({ events: [], activities: [], worlds: [], pushAvailable: false })
    );
    return () => {
      active = false;
    };
  }, []);
  return options;
}
