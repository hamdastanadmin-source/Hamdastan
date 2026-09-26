import Link from 'next/link';

import { toPersianDigits } from '@hamdastan/shared';
import type { AdminUser, Paginated } from '@hamdastan/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hamdastan/ui';

import { UsersTable } from './UsersTable';
import { UsersToolbar } from './UsersToolbar';

/**
 * «مدیریت کاربران», composed.
 *
 * A server component: the list arrives already fetched, so the table renders
 * with data on the first paint and a change made in a dialog shows up through
 * `router.refresh()` rather than through a second copy of the list kept in the
 * browser.
 *
 * The route that renders this is an entry point and nothing else — it resolves
 * the session, reads the query string and hands both here.
 */
export function UsersScreen({
  page,
  search,
}: {
  page: Paginated<AdminUser>;
  search: string;
}) {
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  /** A page link that keeps whatever search is in effect. */
  const href = (target: number) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (target > 1) params.set('page', String(target));
    const query = params.toString();
    return query ? `/users?${query}` : '/users';
  };

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="space-y-1">
          <CardTitle>مدیریت کاربران</CardTitle>
          <CardDescription>
            {toPersianDigits(page.total)} کاربر ادمین ثبت شده است. رمز عبور کاربران
            فقط از طریق بازنشانی رمز موقت قابل تغییر است.
          </CardDescription>
        </div>

        <UsersToolbar search={search} />
      </CardHeader>

      <CardContent className="space-y-4">
        <UsersTable users={page.items} />

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">
              صفحهٔ {toPersianDigits(page.page)} از {toPersianDigits(lastPage)}
            </span>

            <div className="flex items-center gap-2">
              {page.page > 1 && (
                <Link
                  href={href(page.page - 1)}
                  className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
                >
                  قبلی
                </Link>
              )}
              {page.page < lastPage && (
                <Link
                  href={href(page.page + 1)}
                  className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
                >
                  بعدی
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
