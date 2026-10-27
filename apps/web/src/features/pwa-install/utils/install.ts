/**
 * Installing the PWA to the home screen. Chromium hands over one
 * `beforeinstallprompt` event, often before React has loaded and long before
 * the screen that offers it — so a script in the root layout's `<head>`
 * keeps it on `window`. iOS has no such event: Safari's «Add to Home Screen»
 * is the only way, and the offer there is the steps to it.
 */

/** Not in the DOM typings: Chromium only. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** How this device can install: the browser's own dialog, Safari's steps, or not at all. */
export type InstallMethod = 'prompt' | 'ios' | null;

const DISMISSED_KEY = 'hd:install-dismissed-at';
/** After «بعداً», the offer stays away this long. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
/** Fired on `window` whenever the kept event comes or goes. */
const CHANGE_EVENT = 'hd:installprompt';

type InstallWindow = Window & { __hdInstallPrompt?: BeforeInstallPromptEvent | null };

/**
 * Rendered in the root layout's `<head>`. Preventing the default replaces the
 * browser's mini-infobar with our offer.
 */
export const INSTALL_CAPTURE_SCRIPT = `addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__hdInstallPrompt=e;dispatchEvent(new Event('${CHANGE_EVENT}'))});addEventListener('appinstalled',function(){window.__hdInstallPrompt=null;dispatchEvent(new Event('${CHANGE_EVENT}'))});`;

export function subscribeInstall(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  // iPadOS reports itself as a Mac; the touch screen gives it away.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function installMethod(): InstallMethod {
  if (isStandalone()) return null;
  if ((window as InstallWindow).__hdInstallPrompt) return 'prompt';
  return isIos() ? 'ios' : null;
}

/** Opens the browser's install dialog; true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = (window as InstallWindow).__hdInstallPrompt;
  if (!event) return false;
  // The event is good for one prompt only.
  (window as InstallWindow).__hdInstallPrompt = null;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  await event.prompt();
  return (await event.userChoice).outcome === 'accepted';
}

export function isInstallSnoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function snoozeInstall(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Private mode: the offer may come back, which is harmless.
  }
}
