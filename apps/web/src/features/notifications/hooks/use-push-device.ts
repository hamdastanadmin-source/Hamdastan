'use client';

import { useCallback, useEffect, useState } from 'react';

import { notificationsService } from '@/services';

import { currentSubscription, pushSupported, subscribeDevice, unsubscribeDevice } from '../utils/push';

/**
 * - `unavailable` — the API has no push service, or this browser cannot do push
 * - `denied` — the person blocked notifications for this site in the browser
 * - `off` / `on` — this device is (not) subscribed
 */
export type PushDeviceState = 'checking' | 'unavailable' | 'denied' | 'off' | 'on';

/** What this device can do and has done, read from the browser. */
async function readState(publicKey: string | null): Promise<PushDeviceState> {
  if (!publicKey || !pushSupported()) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const subscription = await currentSubscription();
    return subscription && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/**
 * This device's «اعلان گوشی» switch. Permission is asked for only when the
 * person turns it on — never on a page load, never twice after a «no»:
 * once the browser says denied, only the browser's own settings can change
 * it, and the screen says so instead of asking again.
 */
export function usePushDevice(publicKey: string | null) {
  const [state, setState] = useState<PushDeviceState>('checking');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    readState(publicKey).then((next) => active && setState(next));
    return () => {
      active = false;
    };
  }, [publicKey]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setPending(true);
    try {
      const subscription = await subscribeDevice(publicKey);
      if (!subscription) {
        setState(Notification.permission === 'denied' ? 'denied' : 'off');
        return;
      }
      await notificationsService.subscribe(subscription);
      setState('on');
    } finally {
      setPending(false);
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setPending(true);
    try {
      const endpoint = await unsubscribeDevice();
      if (endpoint) await notificationsService.unsubscribe(endpoint);
      setState('off');
    } finally {
      setPending(false);
    }
  }, []);

  return { state, pending, enable, disable };
}
