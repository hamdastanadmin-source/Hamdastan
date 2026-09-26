import { smsProvider } from '../sms';
import { SmsDeliveryError } from '../sms/sms-provider';

import { OtpDeliveryError, type OtpMessage, type OtpProvider } from './otp-provider';

/**
 * Delivers a one-time code as a text message.
 *
 * Everything a code needs beyond a gateway is here: the Persian template, and
 * the translation of a gateway refusal into the error `auth.service.ts`
 * understands. The gateway itself is whatever `smsProvider()` returns, which is
 * why there is no mock OTP provider — the mock lives one layer down, in
 * `integrations/sms`, and serves every kind of message the product sends.
 */

function composeMessage({ code, expiresInSeconds }: OtpMessage): string {
  const minutes = Math.max(1, Math.round(expiresInSeconds / 60));
  return `کد ورود شما به هم‌داستان: ${code}\nاین کد تا ${minutes} دقیقه معتبر است.`;
}

export const smsOtpProvider: OtpProvider = {
  name: 'sms',

  async send(message) {
    try {
      await smsProvider().send({
        phone: message.phone,
        text: composeMessage(message),
        purpose: 'OTP',
      });
    } catch (error) {
      if (error instanceof SmsDeliveryError) {
        throw new OtpDeliveryError(error.provider, error.message, error);
      }
      throw error;
    }
  },
};
