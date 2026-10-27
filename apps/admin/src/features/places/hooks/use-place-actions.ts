'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import type { AdminPlaceDetail, PlaceStatusAction } from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminPlacesService } from '@/services';

import { PLACE_ACTION_DONE } from '../utils/labels';

type Target = { id: string; name: string };

/**
 * A place's status changes and its deletion, from the list or its own page.
 * Deleting asks first (`dialog` is the ConfirmDialog's props); a status
 * change runs at once. `run` answers the place as the API now has it — null
 * after a deletion or a refusal.
 */
export function usePlaceActions({ onChanged, onDeleted }: { onChanged?: (detail: AdminPlaceDetail) => void; onDeleted?: (id: string) => void }) {
  const [deleting, setDeleting] = useState<Target | null>(null);

  const run = async (place: Target, action: PlaceStatusAction): Promise<AdminPlaceDetail | null> => {
    try {
      const detail = await adminPlacesService.changeStatus(place.id, action);
      toast.success(`«${place.name}» ${PLACE_ACTION_DONE[action]}`);
      onChanged?.(detail);
      return detail;
    } catch (error) {
      toast.error(errorMessage(error));
      return null;
    }
  };

  const dialog = {
    pending: deleting && {
      title: `حذف «${deleting.name}»`,
      description: 'این مکان و تسک‌های متصل به آن برای همیشه از این مکان برداشته می‌شوند. خود فعالیت‌ها در استودیو می‌مانند.',
      confirm: 'حذف',
    },
    onCancel: () => setDeleting(null),
    onConfirm: async () => {
      if (!deleting) return;
      try {
        await adminPlacesService.remove(deleting.id);
        toast.success(`«${deleting.name}» حذف شد`);
        onDeleted?.(deleting.id);
      } catch (error) {
        toast.error(errorMessage(error));
      }
      setDeleting(null);
    },
  };

  return { run, remove: setDeleting, dialog };
}
