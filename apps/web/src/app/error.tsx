'use client';

import { Button } from '@hamdastan/ui';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">خطایی رخ داد</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          مشکلی در بارگذاری این صفحه پیش آمده است. لطفاً دوباره تلاش کنید.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/50 font-mono">
            کد خطا: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        <RotateCcw className="h-4 w-4" />
        تلاش مجدد
      </Button>
    </div>
  );
}
