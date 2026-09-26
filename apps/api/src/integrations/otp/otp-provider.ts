/**
 * The contract for delivering a one-time code.
 *
 * The auth service depends on this interface and never on a vendor. The only
 * implementation is `sms-otp-provider.ts`, which renders the code into a
 * message and hands it to `integrations/sms` — so adding a real gateway means
 * writing one SMS adapter and pointing `SMS_PROVIDER` at it. No business logic
 * moves, and nothing here knows which vendor answered.
 *
 * Deliberately narrow: a provider delivers a message and reports whether it
 * managed to. It does not generate the code, decide when it expires, or know
 * anything about users — those are the service's decisions.
 */

export type OtpMessage = {
  /** Normalised to `09xxxxxxxxx`. */
  phone: string;
  code: string;
  /** So a provider can render "valid for N minutes" in its own template. */
  expiresInSeconds: number;
};

export interface OtpProvider {
  /** Identifies the adapter in logs. */
  readonly name: string;
  /** Rejects with `OtpDeliveryError` when the gateway refuses the message. */
  send(message: OtpMessage): Promise<void>;
}

/**
 * Raised by a provider when delivery fails. The auth service turns it into a
 * `502 OTP_DELIVERY_FAILED` — the caller may retry, and nothing has been
 * persisted.
 */
export class OtpDeliveryError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OtpDeliveryError';
  }
}
