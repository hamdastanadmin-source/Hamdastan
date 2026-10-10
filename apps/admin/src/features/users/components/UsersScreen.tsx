'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminUser } from '@hamdastan/types';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

import { errorMessage, ROLE_LABELS } from '@/lib';

import { useAdminUsers } from '../hooks/use-admin-users';
import { formatDateTime, fullName } from '../utils/format';
import { ConfirmUserDialog, type ConfirmAction } from './ConfirmUserDialog';
import { UserFormDialog } from './UserFormDialog';

/** The dialog state: closed, creating, or editing one user. */
type Editing = { mode: 'create' } | { mode: 'edit'; user: AdminUser } | null;

const COLUMNS = 7;

/** The columns that drop out on narrow screens, by index. */
const HIDDEN_BELOW: Record<number, string> = {
  1: 'hidden sm:table-cell',
  3: 'hidden md:table-cell',
  4: 'hidden lg:table-cell',
  5: 'hidden xl:table-cell',
};

/**
 * مدیریت کاربران — who may sign in to the admin panel.
 *
 * The status switch is the quick path; the edit dialog changes everything
 * else. Your own row cannot be switched off or deleted, which is what
 * guarantees the panel always has an admin who can get in — the API refuses
 * both too.
 */
export function UsersScreen({ currentAdminId }: { currentAdminId: string }) {
  const {
    search,
    setSearch,
    page,
    setPage,
    data,
    loading,
    error,
    reload,
    createUser,
    updateUser,
    deleteUser,
  } = useAdminUsers();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirming, setConfirming] = useState<{ action: ConfirmAction; user: AdminUser } | null>(
    null
  );
  const [pendingId, setPendingId] = useState<string | null>(null);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const firstLoad = loading && !data;

  const changeStatus = async (user: AdminUser, status: AdminUser['status']) => {
    setPendingId(user.id);
    try {
      await updateUser(user.id, { status });
      toast.success(
        status === 'active'
          ? `«${fullName(user)}» فعال شد`
          : `«${fullName(user)}» غیرفعال شد و نشست‌هاش بسته شد`
      );
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  };

  const removeUser = async (user: AdminUser) => {
    setPendingId(user.id);
    try {
      await deleteUser(user.id);
      // The last row of a later page: step back rather than show an empty page.
      if (data && data.items.length === 1 && page > 1) setPage(page - 1);
      toast.success(`«${fullName(user)}» حذف شد`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">مدیریت کاربران</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            فقط کاربران فعالِ این فهرست می‌تونن وارد پنل مدیریت بشن.
          </p>
        </div>
        <Button onClick={() => setEditing({ mode: 'create' })}>
          <Plus aria-hidden="true" />
          کاربر جدید
        </Button>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی نام یا شماره"
              aria-label="جستجوی کاربران"
              className="ps-9"
            />
          </div>
          {data && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {toPersianDigits(data.total)} کاربر
            </p>
          )}
        </CardContent>

        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>فهرست کاربران بارگذاری نشد</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
                  تلاش دوباره
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <Table aria-busy={loading} className={loading && data ? 'opacity-60 transition-opacity' : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-3 sm:ps-4">نام و نام خانوادگی</TableHead>
                <TableHead className="hidden sm:table-cell">شماره موبایل</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="hidden md:table-cell">نقش</TableHead>
                <TableHead className="hidden lg:table-cell">آخرین ورود</TableHead>
                <TableHead className="hidden xl:table-cell">تاریخ ثبت</TableHead>
                <TableHead className="pe-2 text-end sm:pe-4">
                  <span className="sr-only">عملیات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {firstLoad &&
                Array.from({ length: 5 }, (_, row) => (
                  <TableRow key={row}>
                    {Array.from({ length: COLUMNS }, (_, cell) => (
                      <TableCell key={cell} className={HIDDEN_BELOW[cell]}>
                        <Skeleton className="h-5 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users aria-hidden="true" className="size-8" />
                      {search ? 'کاربری با این مشخصات پیدا نشد' : 'هنوز کاربری ثبت نشده'}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {data?.items.map((user) => {
                const isSelf = user.id === currentAdminId;
                const active = user.status === 'active';
                return (
                  <TableRow key={user.id}>
                    <TableCell className="ps-3 font-medium sm:ps-4">
                      <span className="flex items-center gap-2">
                        {fullName(user)}
                        {isSelf && <Badge variant="outline">شما</Badge>}
                      </span>
                      {/* On a phone the number sits under the name instead of in its own column. */}
                      <span dir="ltr" className="mt-0.5 block text-end text-xs font-normal tabular-nums text-muted-foreground sm:hidden">
                        {toPersianDigits(user.phone)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span dir="ltr" className="tabular-nums">
                        {toPersianDigits(user.phone)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <label className="flex w-fit items-center gap-2">
                        <Switch
                          checked={active}
                          disabled={isSelf || pendingId === user.id}
                          onCheckedChange={(checked) =>
                            checked
                              ? changeStatus(user, 'active')
                              : setConfirming({ action: 'deactivate', user })
                          }
                          aria-label={`وضعیت ${fullName(user)}`}
                        />
                        {/* On a phone the switch alone says it; the row needs the room for the edit button. */}
                        <Badge variant={active ? 'success' : 'secondary'} className="hidden sm:inline-flex">
                          {active ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </label>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatDateTime(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">
                      {formatDateTime(user.createdAt)}
                    </TableCell>
                    <TableCell className="pe-2 text-end sm:pe-4">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing({ mode: 'edit', user })}
                        aria-label={`ویرایش ${fullName(user)}`}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isSelf || pendingId === user.id}
                        onClick={() => setConfirming({ action: 'delete', user })}
                        aria-label={`حذف ${fullName(user)}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {data && totalPages > 1 && (
          <CardContent className="flex items-center justify-between gap-3 border-t p-4">
            <p className="text-sm text-muted-foreground">
              صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                {/* RTL: the previous page lies towards the reading start, on the right. */}
                <ChevronRight aria-hidden="true" />
                قبلی
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                بعدی
                <ChevronLeft aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {editing && (
        <UserFormDialog
          key={editing.mode === 'edit' ? editing.user.id : 'create'}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          user={editing.mode === 'edit' ? editing.user : undefined}
          isSelf={editing.mode === 'edit' && editing.user.id === currentAdminId}
          onSubmit={(fields) =>
            editing.mode === 'edit' ? updateUser(editing.user.id, fields) : createUser(fields)
          }
        />
      )}

      <ConfirmUserDialog
        pending={confirming}
        onCancel={() => setConfirming(null)}
        onConfirm={async (action, user) => {
          await (action === 'delete' ? removeUser(user) : changeStatus(user, 'inactive'));
          setConfirming(null);
        }}
      />
    </div>
  );
}
