import Link from 'next/link';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Button } from '@hamdastan/ui';

import {
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  ScreenTitle,
} from '@/components';

export default function NotFound() {
  return (
    <Screen>
      <ScreenHeader />
      <ScreenBody center className="items-center gap-4 text-center">
        <p className="text-7xl font-extrabold tabular-nums text-muted-foreground/25">
          {toPersianDigits(404)}
        </p>
        <ScreenTitle
          title="صفحه پیدا نشد"
          description="صفحه‌ای که دنبالش بودی وجود نداره یا جابه‌جا شده."
        />
      </ScreenBody>
      <ScreenFooter>
        <Button asChild size="xl" className="w-full">
          <Link href="/">بازگشت به خانه</Link>
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
