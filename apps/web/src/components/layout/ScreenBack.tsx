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
 */
export function ScreenBack({ href, label = 'بازگشت' }: { href: string; label?: string }) {
  return (
    <Button
      asChild
      variant="ghost"
      size="touch"
      // -ms-3 pulls the label back to the 20px page gutter while the button's
      // own padding keeps the tap area wider than the text.
      className="-ms-3 text-muted-foreground hover:text-foreground"
    >
      <Link href={href}>
        {/* rtl-ok: "back" is rightwards in an RTL layout, so this is the
            direction itself rather than a physical edge to be mirrored. */}
        <ArrowRight aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );
}
