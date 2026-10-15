'use client';

import { useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import type { PlayerActivity, PlayerJourneyResult, PlayerMedia } from '@hamdastan/types';
import { Button, Label, Skeleton, Switch } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';

import { useResultCard } from '../../hooks/use-result-card';
import { inviteUrl } from '../../utils/journey';

/**
 * The journey's end: the character the person came out as, on the card they
 * can save or share. The card is the image itself — exactly the PNG that is
 * downloaded or sent — and their name is on it only if the admin allows and
 * they leave it on.
 */
export function ResultScreen({
  activity,
  result,
  media,
  name,
  onBack,
}: {
  activity: PlayerActivity;
  result: PlayerJourneyResult;
  media: Record<string, PlayerMedia>;
  name: string | null;
  onBack: () => void;
}) {
  const canShowName = result.card.showUserName && Boolean(name);
  const [withName, setWithName] = useState(canShowName);
  const card = useResultCard(result, media, withName ? name : null);

  const download = () => {
    if (!card) return;
    const link = document.createElement('a');
    link.href = card.url;
    link.download = card.file.name;
    link.click();
  };

  const share = async () => {
    if (!card) return;
    const files = [card.file];
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: activity.title, text: `${result.character.name} — ${inviteUrl(activity.id, window.location.origin)}` });
      } catch {
        // Closing the sheet is not an error.
      }
      return;
    }
    // No sharing files here: the card is saved instead, to post from the gallery.
    download();
    toast.success('کارت ذخیره شد؛ از گالری به اشتراک بذارش.');
  };

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack onClick={onBack} label="بازگشت به چالش" />
      </ScreenHeader>
      <ScreenBody className="items-center gap-5 pt-2">
        <ScreenTitle title={result.character.name} description={result.character.title} className="text-center" />
        <div className="aspect-[9/16] w-full max-w-72 overflow-hidden rounded-2xl border shadow-sm">
          {card ? (
            // eslint-disable-next-line @next/next/no-img-element -- a PNG drawn on this device, shown as is.
            <img src={card.url} alt={`کارت شخصیت ${result.character.name}`} className="size-full object-contain" />
          ) : (
            <Skeleton className="size-full" />
          )}
        </div>
        {result.character.description && (
          <p className="text-center text-base leading-relaxed text-muted-foreground">{result.character.description}</p>
        )}
        {canShowName && (
          <div className="flex w-full items-center justify-between gap-3 rounded-xl border p-3">
            <Label htmlFor="card-name">اسمم روی کارت باشه</Label>
            <Switch id="card-name" checked={withName} onCheckedChange={setWithName} />
          </div>
        )}
      </ScreenBody>
      <ScreenFooter className="flex flex-col gap-2">
        <Button size="xl" className="w-full" onClick={share} disabled={!card}>
          <Share2 aria-hidden="true" />
          اشتراک‌گذاری کارت
        </Button>
        <Button size="xl" variant="ghost" className="w-full" onClick={download} disabled={!card}>
          <Download aria-hidden="true" />
          دانلود تصویر
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
