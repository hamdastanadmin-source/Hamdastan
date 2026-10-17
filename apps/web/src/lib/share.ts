/**
 * Sharing a link — a journey invitation, an event: the system's own share
 * sheet where the device has one, the clipboard where it does not. Neither is a network call — the
 * link is to this site, and nothing is sent anywhere by us.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareInvite(invite: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(invite);
      return 'shared';
    } catch (error) {
      // Closing the sheet is not a failure; anything else falls through to copying.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${invite.text}\n${invite.url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
