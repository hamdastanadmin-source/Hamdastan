import type { SmsSender } from './sms-sender';

/**
 * Kaveh-Negar's verify lookup — the transactional endpoint, not the bulk
 * one. It is the provider the product has chosen; nothing here is wired up
 * until `SMS_PROVIDER=kavenegar` selects it in `server.ts`.
 *
 * `plain fetch` rather than the vendor SDK: this is one GET with three query
 * parameters, and the SDK is a callback-era wrapper around the same URL.
 */
export function createKavenegarSmsSender(options: {
  apiKey: string;
  template: string;
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

      const response = await doFetch(url, { method: 'GET' });
      const body = (await response.json().catch(() => null)) as
        | { return?: { status?: number; message?: string } }
        | null;

      // Kaveh-Negar answers 200 with a failure status inside the body, so the
      // HTTP status alone does not say whether the message went out.
      const status = body?.return?.status;
      if (!response.ok || status !== 200) {
        throw new Error(
          `kavenegar refused the send (status ${status ?? response.status}): ${
            body?.return?.message ?? response.statusText
          }`
        );
      }
    },
  };
}
