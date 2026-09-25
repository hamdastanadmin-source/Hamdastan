/**
 * The contract for delivering a one-time code.
 *
 * The auth service depends on this interface and never on a vendor. Adding a
 * real SMS gateway means writing one more implementation and pointing
 * `OTP_PROVIDER` at it — no business logic moves.
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
