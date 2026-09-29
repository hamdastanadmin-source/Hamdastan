/**
 * Outbound adapters — the only place the API talks to somebody else's
 * service. Each is a port plus one implementation per provider, so a service
 * depends on the capability and never on the vendor.
 */
export type { SmsSender } from './sms/sms-sender';
export { createConsoleSmsSender } from './sms/console-sms-sender';
export { createKavenegarSmsSender } from './sms/kavenegar-sms-sender';
