/**
 * Outbound adapters: SMS gateways, payment providers, object storage, push
 * services — anything this API calls that it does not own.
 *
 * Each integration exposes an interface plus one implementation per vendor, so
 * a service depends on the capability rather than the vendor and a provider
 * can be swapped without the service changing. Same rule as the repositories
 * in `shared/repository.ts`.
 *
 *   sms/  sending a text message — mock only, no gateway contracted yet
 *   otp/  one-time codes, as a template over sms/
 *
 * `otp` is not a second gateway. It composes the code into a message and hands
 * it to `sms`, which is the one place a vendor is ever named.
 */

export {
  otpProvider,
  OtpDeliveryError,
  type OtpMessage,
  type OtpProvider,
} from './otp';

export {
  smsProvider,
  SmsDeliveryError,
  mockSmsProvider,
  type MockSmsProvider,
  type SmsMessage,
  type SmsProvider,
  type SmsPurpose,
} from './sms';
