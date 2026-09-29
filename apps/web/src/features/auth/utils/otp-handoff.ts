/**
 * Carrying the development one-time code from the phone screen to the verify
 * screen.
 *
 * With `OTP_DEBUG_DISPLAY` on, the API returns the code it just issued so the
 * flow can be walked through before the SMS provider is connected. The code
 * arrives on the screen that *asked* for it and is needed on the next one, so
 * it rides in `sessionStorage`: per-tab, it survives the navigation and a
 * reload, and it disappears when the tab does.
 *
 * It is exposed as a subscribable store rather than as a plain getter so the
 * verify screen can read it with `useSyncExternalStore` — which is React's
 * answer to "a value that exists in the browser and not on the server", and
 * avoids both a hydration mismatch and a `setState` in an effect.
 *
 * Every access is guarded. `sessionStorage` throws outright in a privacy mode
 * that blocks site data, and a verification screen that failed to render
 * because of a debug aid would be a poor trade.
 */

const KEY = 'hd:otp-debug-code';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeDebugCode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDebugCode(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** On the server there is no storage, and so no code. */
export function getServerDebugCode(): null {
  return null;
}

export function rememberDebugCode(code: string | undefined): void {
  try {
    if (code) sessionStorage.setItem(KEY, code);
    else sessionStorage.removeItem(KEY);
  } catch {
    // No session storage: the code simply is not shown.
  }
  emit();
}

export function forgetDebugCode(): void {
  rememberDebugCode(undefined);
}
