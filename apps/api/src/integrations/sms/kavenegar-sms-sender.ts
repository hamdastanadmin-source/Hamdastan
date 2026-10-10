import { AppError } from '../../shared/errors';

import type { SmsSender } from './sms-sender';

/** What a caller sees when the provider cannot be reached or refuses. */
const unavailable = () =>
  new AppError(503, 'SMS_UNAVAILABLE', 'ارسال پیامک الان ممکن نشد، کمی بعد دوباره امتحان کن');

/**
 * Kaveh-Negar's verify lookup — the transactional endpoint, not the bulk
 * one. It is the provider the product has chosen; nothing here is wired up
 * until `SMS_PROVIDER=kavenegar` selects it in `server.ts`.
 *
 * `plain fetch` rather than the vendor SDK: this is one GET with three query
 * parameters, and the SDK is a callback-era wrapper around the same URL.
 *
 * Bounded by `timeoutMs` and never retried: a request that timed out may
 * still have been delivered, and sending again is a second SMS to somebody's
 * phone. The failure surfaces as a 503; the provider's own message goes to
 * the log, never to the caller — the request URL carries the API key.
 */
export function createKavenegarSmsSender(options: {
  apiKey: string;
  template: string;
  timeoutMs: number;
  log: { error(details: object, message: string): void };
  fetchImpl?: typeof fetch;
}): SmsSender {
  const doFetch = options.fetchImpl ?? globalThis.fetch;

  return {
    name: 'kavenegar',
    async sendOtp(phone, code) {
      const url = new URL(
        `https://api.kavenegar.com/v1/${options.apiKey}/verify/lookup.json`
      );
      url.searchParams.set('receptor', phone);
      url.searchParams.set('token', code);
      url.searchParams.set('template', options.template);

      let response: Response;
      try {
        response = await doFetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(options.timeoutMs),
        });
      } catch (error) {
        options.log.error(
          { reason: error instanceof Error ? error.name : 'unknown' },
          '[sms:kavenegar] request failed'
        );
        throw unavailable();
      }
      const body = (await response.json().catch(() => null)) as
        | { return?: { status?: number; message?: string } }
        | null;

      // Kaveh-Negar answers 200 with a failure status inside the body, so the
      // HTTP status alone does not say whether the message went out.
      const status = body?.return?.status;
      if (!response.ok || status !== 200) {
        options.log.error(
          { status: status ?? response.status, message: body?.return?.message },
          '[sms:kavenegar] send refused'
        );
        throw unavailable();
      }
    },
  };
}
