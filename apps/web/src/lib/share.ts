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

/** An image drawn on this device, and an object URL it is shown at. */
export type SharedImage = { file: File; url: string };

/** Saves the image to the device. */
export function saveImage(image: SharedImage): void {
  const link = document.createElement('a');
  link.href = image.url;
  link.download = image.file.name;
  link.click();
}

/**
 * Sharing an image — a result card: the share sheet where the device can send
 * files, otherwise the image is saved, to post from the gallery.
 */
export async function shareImage(image: SharedImage, share: { title: string; text: string }): Promise<'shared' | 'saved' | 'cancelled'> {
  const files = [image.file];
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, ...share });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  saveImage(image);
  return 'saved';
}
