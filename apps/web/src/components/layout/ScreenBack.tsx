import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button } from '@hamdastan/ui';

/**
 * The back control in a screen header.
 *
 * `size="touch"` is the 44px header-control size; a 32px `sm` button misses
 * the touch minimum, and this is often the only way off a screen. The arrow
 * points the way the reader came from: this is an RTL product, so back is
 * rightwards, and the mirrored glyph would read as forward.
 *
 * `href` leaves the page; `onClick` steps back inside it — the questionnaire
 * is one page with many screens, and its back is a screen, not a URL.
 */
export function ScreenBack({
  label = 'بازگشت',
  ...target
}: { label?: string } & ({ href: string } | { onClick: () => void })) {
  const content = (
    <>
      {/* rtl-ok: "back" is rightwards in an RTL layout, so this is the
          direction itself rather than a physical edge to be mirrored. */}
      <ArrowRight aria-hidden="true" />
      {label}
    </>
  );

  return (
    <Button
      asChild={'href' in target}
      variant="ghost"
      size="touch"
      // -ms-3 pulls the label back to the 20px page gutter while the button's
      // own padding keeps the tap area wider than the text.
      className="-ms-3 text-muted-foreground hover:text-foreground"
      {...('onClick' in target ? { type: 'button' as const, onClick: target.onClick } : {})}
    >
      {'href' in target ? <Link href={target.href}>{content}</Link> : content}
    </Button>
  );
}
