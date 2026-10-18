'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { AdminCampaign, CampaignInput } from '@hamdastan/types';

import { fieldErrors } from '@/lib';
import { adminNotificationsService } from '@/services';

export const EMPTY_CAMPAIGN: CampaignInput = {
  title: '',
  body: '',
  category: 'events',
  imageId: null,
  destination: { kind: 'none' },
  audience: { kind: 'users', phones: [] },
  push: false,
};

const inputOf = (campaign: AdminCampaign): CampaignInput => ({
  title: campaign.title,
  body: campaign.body,
  category: campaign.category,
  imageId: campaign.imageId,
  destination: campaign.destination,
  audience: campaign.audience,
  push: campaign.push,
});

/**
 * A campaign being written: its fields, the API's per-field errors, and the
 * two writes — save the draft, and send (which saves first, so what is sent
 * is exactly what is on screen). The API decides whether either may happen.
 */
export function useCampaignEditor(initial: AdminCampaign | null) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<AdminCampaign | null>(initial);
  const [state, setState] = useState<CampaignInput>(initial ? inputOf(initial) : EMPTY_CAMPAIGN);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const update = useCallback((patch: Partial<CampaignInput>) => {
    setState((current) => ({ ...current, ...patch }));
    setDirty(true);
  }, []);

  const save = useCallback(async (): Promise<AdminCampaign> => {
    try {
      const saved = campaign
        ? await adminNotificationsService.update(campaign.id, state)
        : await adminNotificationsService.create(state);
      setCampaign(saved);
      setErrors({});
      setDirty(false);
      if (!campaign) router.replace(`/notifications/${saved.id}`);
      return saved;
    } catch (error) {
      setErrors(fieldErrors(error));
      throw error;
    }
  }, [campaign, state, router]);

  const send = useCallback(
    async (scheduledAt: string | null): Promise<AdminCampaign> => {
      const saved = dirty || !campaign ? await save() : campaign;
      try {
        const sent = await adminNotificationsService.send(saved.id, scheduledAt);
        setCampaign(sent);
        return sent;
      } catch (error) {
        setErrors(fieldErrors(error));
        throw error;
      }
    },
    [campaign, dirty, save]
  );

  return { campaign, setCampaign, state, update, errors, dirty, save, send };
}
