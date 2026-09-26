/**
 * The contract for sending a text message.
 *
 * This is the one gateway capability in the project: both the product's
 * one-time codes and the admin panel's credentials leave through it, so there
 * is a single vendor adapter to write when an SMS gateway is contracted rather
 * than one per message type.
 *
 * Deliberately narrow: a provider delivers text to a number and reports whether
 * it managed to. It composes nothing, decides nothing and knows nothing about
 * users, codes or passwords — those are the calling service's decisions, and
 * keeping them there is what lets the vendor change without the rules changing.
 */

/** What a message is for. Logged, and how the mock's outbox is filtered. */
export type SmsPurpose = 'OTP' | 'ADMIN_CREDENTIALS';

export type SmsMessage = {
  /** Normalised to `09xxxxxxxxx`. */
  phone: string;
  /** The message body, already composed and already in Persian. */
  text: string;
  purpose: SmsPurpose;
};

export interface SmsProvider {
  /** Identifies the adapter in logs. */
  readonly name: string;
  /** Rejects with `SmsDeliveryError` when the gateway refuses the message. */
  send(message: SmsMessage): Promise<void>;
}

/**
 * Raised by a provider when delivery fails.
 *
 * The caller decides what that means: the auth service turns it into a
 * `502 OTP_DELIVERY_FAILED` and leaves the user free to retry, while creating
 * an admin account records that the credentials did not go out and carries on,
 * because the account exists and its password can be reset.
 */
export class SmsDeliveryError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SmsDeliveryError';
  }
}
