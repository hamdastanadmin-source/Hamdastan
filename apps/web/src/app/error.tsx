'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button, IconBadge } from '@hamdastan/ui';

import {
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  ScreenTitle,
} from '@/components';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Screen>
      <ScreenHeader />
      <ScreenBody center className="items-center gap-4 text-center">
        <IconBadge tone="destructive">
          <AlertTriangle aria-hidden="true" />
        </IconBadge>
        <ScreenTitle
          title="خطایی رخ داد"
          description="مشکلی در بارگذاری این صفحه پیش آمده است. لطفاً دوباره تلاش کن."
        />
        {error.digest && (
          <p dir="ltr" className="font-mono text-xs text-muted-foreground/60">
            {error.digest}
          </p>
        )}
      </ScreenBody>
      <ScreenFooter>
        <Button
          onClick={reset}
          size="xl"
          className="w-full"
        >
          <RotateCcw aria-hidden="true" />
          تلاش دوباره
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
