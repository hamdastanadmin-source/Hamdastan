'use client';

import { useState } from 'react';

import type { NotificationPreference } from '@hamdastan/types';

import { notificationsService } from '@/services';

/**
 * The category switches. Each flip saves at once and steps back if the API
 * refuses it — the same rule as the account's other switches.
 */
export function usePreferences(saved: NotificationPreference[]) {
  const [categories, setCategories] = useState(saved);

  const update = async (category: NotificationPreference['category'], patch: Partial<Omit<NotificationPreference, 'category'>>) => {
    const previous = categories;
    const next = categories.map((row) => (row.category === category ? { ...row, ...patch } : row));
    setCategories(next);
    try {
      setCategories((await notificationsService.savePreferences(next)).categories);
    } catch (error) {
      setCategories(previous);
      throw error;
    }
  };

  return { categories, update };
}
