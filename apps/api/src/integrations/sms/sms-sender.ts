/**
 * The port the auth service sends one-time codes through.
 *
 * It is one method wide on purpose. The service knows that a code has to
 * reach a phone; it does not know that the provider is Kaveh-Negar, that
 * Kaveh-Negar calls this a "verify lookup", or that the template name is an
 * environment variable. Connecting the real provider is therefore a new file
 * in this directory and one line in `server.ts`.
 */
export interface SmsSender {
  /** Human-readable, for logs and `/health`. */
  readonly name: string;
  /**
   * Delivers `code` to `phone`. Throwing means the code did not go out, and
   * the caller will report the send as failed rather than start a timer for
   * a message that never arrives.
   */
  sendOtp(phone: string, code: string): Promise<void>;
}
