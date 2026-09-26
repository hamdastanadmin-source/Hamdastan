/**
 * Delivery of one-time codes — the outbound side of the product's auth module.
 *
 * `otpProvider()` is the only thing `modules/auth` calls. It is a thin template
 * over `integrations/sms`: a code becomes a Persian message and leaves through
 * the one gateway adapter the project has, so contracting a vendor is one
 * implementation in `sms/`, not one per message type.
 */

import { smsOtpProvider } from './sms-otp-provider';
import type { OtpProvider } from './otp-provider';

export function otpProvider(): OtpProvider {
  return smsOtpProvider;
}

export { OtpDeliveryError } from './otp-provider';
export type { OtpMessage, OtpProvider } from './otp-provider';
export { smsOtpProvider } from './sms-otp-provider';
