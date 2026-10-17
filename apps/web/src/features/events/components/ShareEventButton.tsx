'use client';

import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@hamdastan/ui';

import { shareInvite } from '@/lib';

/** Shares the event's page: the system's share sheet, or the link copied. */
export function ShareEventButton({ title, slug }: { title: string; slug: string }) {
  const share = async () => {
    const outcome = await shareInvite({ title, text: `«${title}» توی هم‌داستان`, url: `${window.location.origin}/events/${slug}` });
    if (outcome === 'copied') toast.success('لینک رویداد کپی شد');
    if (outcome === 'failed') toast.error('اشتراک‌گذاری ممکن نشد');
  };

  return (
    <Button variant="ghost" size="touch" className="-me-3 text-muted-foreground hover:text-foreground" onClick={share} aria-label="اشتراک‌گذاری">
      <Share2 aria-hidden="true" />
    </Button>
  );
}
