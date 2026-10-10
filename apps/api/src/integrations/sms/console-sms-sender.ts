import type { FastifyBaseLogger } from 'fastify';

import type { SmsSender } from './sms-sender';

/**
 * The development sender: it writes the code to the log instead of sending
 * it. Paired with `OTP_DEBUG_DISPLAY`, it makes the whole sign-in flow
 * exercisable — by a developer, by Playwright, by the product team on the
 * staging host — before an SMS contract exists.
 *
 * It never becomes the production sender by accident: `SMS_PROVIDER` picks
 * one, and `kavenegar` is the value the deployed environment sets.
 *
 * In production the code is masked: a log is read by more people, and kept
 * for longer, than a one-time code should ever be.
 */
export function createConsoleSmsSender(
  log: FastifyBaseLogger,
  options: { revealCode: boolean }
): SmsSender {
  return {
    name: 'console',
    async sendOtp(phone, code) {
      log.info(
        { phone, code: options.revealCode ? code : '******' },
        '[sms:console] one-time code'
      );
    },
  };
}
