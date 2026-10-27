'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { installMethod, isInstallSnoozed, promptInstall, snoozeInstall, subscribeInstall } from '../utils/install';

/** The offer waits this long, so the result is seen before anything covers it. */
const OFFER_DELAY_MS = 2500;

/**
 * Whether to offer installing the app here, and the two ways out of it. The
 * offer opens once, after a moment, on a device that can install and has not
 * said «بعداً» lately.
 */
export function useInstallOffer() {
  const method = useSyncExternalStore(subscribeInstall, installMethod, () => null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!method || isInstallSnoozed()) return;
    const timer = window.setTimeout(() => setOpen(true), OFFER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [method]);

  const dismiss = () => {
    snoozeInstall();
    setOpen(false);
  };

  const install = async () => {
    setOpen(false);
    if (!(await promptInstall())) snoozeInstall();
  };

  return { method, open, dismiss, install };
}
