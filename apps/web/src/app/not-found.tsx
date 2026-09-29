import Link from 'next/link';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Button } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';

export default function NotFound() {
  return (
    <Screen>
      <ScreenHeader />
      <ScreenBody className="flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-6xl font-extrabold text-muted-foreground/30">
          {toPersianDigits(404)}
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">صفحه پیدا نشد</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          صفحه‌ای که دنبالش بودی وجود نداره یا جابه‌جا شده.
        </p>
      </ScreenBody>
      <ScreenFooter>
        <Button asChild size="lg" className="h-12 w-full text-base font-bold">
          <Link href="/">بازگشت به خانه</Link>
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
