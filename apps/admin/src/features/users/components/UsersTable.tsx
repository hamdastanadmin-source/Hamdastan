'use client';

import { useState } from 'react';
import { KeyRound, MoreHorizontal, Pencil } from 'lucide-react';

import { formatJalaliDate } from '@hamdastan/shared';
import type { AdminUser } from '@hamdastan/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

import { useHasPermission } from '@/features/auth';

import { EditUserForm } from './EditUserForm';
import { ResetPasswordDialog } from './ResetPasswordDialog';

/**
 * The admin accounts, as a table.
 *
 * Every value it shows was decided by the backend, including whether an account
 * has expired: comparing dates in the browser would make the answer depend on
 * the viewer's clock, which is not the clock that grants access.
 *
 * The actions menu hides what the signed-in admin has no permission for. That
 * is presentation — `apps/api` refuses the same request either way — and it is
 * why an empty menu is possible rather than an error.
 */

/** The one badge that says what state the account is actually in. */
function StatusBadge({ user }: { user: AdminUser }) {
  if (user.status === 'SUSPENDED') return <Badge variant="error">غیرفعال</Badge>;
  if (user.accessExpired) return <Badge variant="warning">اعتبار تمام‌شده</Badge>;
  if (user.mustChangePassword) return <Badge variant="info">در انتظار تغییر رمز</Badge>;
  return <Badge variant="success">فعال</Badge>;
}

export function UsersTable({ users }: { users: AdminUser[] }) {
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const canEdit = useHasPermission('users.edit');
  const canResetPassword = useHasPermission('users.reset_password');

  if (users.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        کاربری با این مشخصات پیدا نشد.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>نام</TableHead>
            <TableHead>نام خانوادگی</TableHead>
            <TableHead>نام کاربری</TableHead>
            <TableHead>شماره موبایل</TableHead>
            <TableHead>نقش</TableHead>
            <TableHead>اعتبار دسترسی</TableHead>
            <TableHead>وضعیت</TableHead>
            <TableHead className="text-end">عملیات</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.firstName}</TableCell>
              <TableCell>{user.lastName}</TableCell>
              <TableCell>
                {/* rtl-ok: a username is Latin-only, so it reads left-to-right. */}
                <span dir="ltr" className="font-mono text-xs">
                  {user.username}
                </span>
              </TableCell>
              <TableCell>
                {/* rtl-ok: a phone number is read left-to-right in every locale. */}
                <span dir="ltr" className="font-mono text-xs">
                  {user.mobile}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{user.roleName}</Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {formatJalaliDate(user.accessExpiresAt)}
              </TableCell>
              <TableCell>
                <StatusBadge user={user} />
              </TableCell>
              <TableCell className="text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`عملیات ${user.fullName}`}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                      {user.fullName}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {canEdit && (
                      <DropdownMenuItem onSelect={() => setEditing(user)}>
                        <Pencil className="size-4 me-2" />
                        مشاهده و ویرایش اطلاعات
                      </DropdownMenuItem>
                    )}

                    {canResetPassword && (
                      <DropdownMenuItem onSelect={() => setResetting(user)}>
                        <KeyRound className="size-4 me-2" />
                        بازنشانی و ارسال رمز موقت
                      </DropdownMenuItem>
                    )}

                    {!canEdit && !canResetPassword && (
                      <DropdownMenuItem disabled>دسترسی به عملیات ندارید</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Keyed by account, so opening a second row starts from that row's data
          rather than the first one's. */}
      {editing && (
        <EditUserForm
          key={`edit-${editing.id}`}
          user={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}

      {resetting && (
        <ResetPasswordDialog
          key={`reset-${resetting.id}`}
          user={resetting}
          open
          onOpenChange={(open) => !open && setResetting(null)}
        />
      )}
    </>
  );
}
