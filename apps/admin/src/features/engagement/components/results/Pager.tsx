import { ChevronLeft, ChevronRight } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Button } from '@hamdastan/ui';

/** «قبلی / بعدی» under a paged list; hidden when there is one page. */
export function Pager({
  page,
  pageSize,
  total,
  loading,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        صفحه {toPersianDigits(page)} از {toPersianDigits(pages)}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
          <ChevronRight aria-hidden="true" />
          قبلی
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>
          بعدی
          <ChevronLeft aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
