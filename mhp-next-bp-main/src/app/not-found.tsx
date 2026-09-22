import Link from 'next/link';
import { Button } from '@/components/UiComponents';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-1">
        <h1 className="text-6xl font-bold text-muted-foreground/30">۴۰۴</h1>
        <h2 className="text-xl font-bold">صفحه یافت نشد</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          صفحه‌ای که به دنبال آن هستید وجود ندارد یا منتقل شده است.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">
          <Home className="h-4 w-4" />
          بازگشت به خانه
        </Link>
      </Button>
    </div>
  );
}
