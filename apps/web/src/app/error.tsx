'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';

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
      <ScreenBody className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle aria-hidden="true" className="size-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-extrabold leading-tight">خطایی رخ داد</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          مشکلی در بارگذاری این صفحه پیش آمده است. لطفاً دوباره تلاش کن.
        </p>
        {error.digest && (
          <p dir="ltr" className="font-mono text-xs text-muted-foreground/60">
            {error.digest}
          </p>
        )}
      </ScreenBody>
      <ScreenFooter>
        <Button
          onClick={reset}
          size="lg"
          className="h-12 w-full text-base font-bold"
        >
          <RotateCcw aria-hidden="true" />
          تلاش دوباره
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
