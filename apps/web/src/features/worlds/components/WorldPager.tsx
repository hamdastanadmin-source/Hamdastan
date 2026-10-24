import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Button } from '@hamdastan/ui';

/** Earlier and later pages of a world's list, as addresses. Absent when there is one page. */
export function WorldPager({ page, total, pageSize, hrefOf }: { page: number; total: number; pageSize: number; hrefOf: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="صفحه‌ها" className="flex items-center justify-between gap-3">
      <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
        {page > 1 ? (
          <Link href={hrefOf(page - 1)}>
            <ChevronRight aria-hidden="true" />
            قبلی
          </Link>
        ) : (
          <span>
            <ChevronRight aria-hidden="true" />
            قبلی
          </span>
        )}
      </Button>
      <span className="text-sm text-muted-foreground">
        {toPersianDigits(page)} از {toPersianDigits(pages)}
      </span>
      <Button asChild={page < pages} variant="outline" size="sm" disabled={page >= pages}>
        {page < pages ? (
          <Link href={hrefOf(page + 1)}>
            بعدی
            <ChevronLeft aria-hidden="true" />
          </Link>
        ) : (
          <span>
            بعدی
            <ChevronLeft aria-hidden="true" />
          </span>
        )}
      </Button>
    </nav>
  );
}
