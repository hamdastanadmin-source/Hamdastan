'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';

import { formatJalaliDate, toPersianDigits } from '@hamdastan/shared';
import type { FormStatus, FormSummary } from '@hamdastan/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@hamdastan/ui';

import { useHasPermission } from '@/features/auth';
import { HttpError } from '@/services';

import { formsApi } from '../services/forms.api';
import { ShareDialog } from './ShareDialog';

/**
 * The forms, as a table.
 *
 * Every row action goes straight to the backend and then refreshes the page,
 * so what is on screen is always what the server holds rather than an optimistic
 * guess. The menu hides what this admin has no permission for — a convenience;
 * the route refuses it either way.
 */

const STATUS: Record<FormStatus, { label: string; variant: 'success' | 'secondary' | 'warning' }> = {
  PUBLISHED: { label: 'منتشرشده', variant: 'success' },
  DRAFT: { label: 'پیش‌نویس', variant: 'secondary' },
  CLOSED: { label: 'بسته‌شده', variant: 'warning' },
};

const CATEGORY: Record<string, string> = {
  FEEDBACK: 'بازخورد',
  SURVEY: 'نظرسنجی',
  CHECKLIST: 'چک‌لیست',
  REQUEST: 'درخواست',
  ASSESSMENT: 'ارزیابی',
  OTHER: 'سایر',
};

export function FormsTable({ forms }: { forms: FormSummary[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FormSummary | null>(null);
  const [sharing, setSharing] = useState<FormSummary | null>(null);

  const canEdit = useHasPermission('forms.edit');
  const canPublish = useHasPermission('forms.publish');
  const canCreate = useHasPermission('forms.create');
  const canDelete = useHasPermission('forms.delete');
  const canSeeResponses = useHasPermission('forms.responses.view');

  /** Runs one row action, reports what happened, and re-reads the list. */
  const run = async (id: string, action: () => Promise<unknown>, done: string) => {
    setBusyId(id);
    try {
      await action();
      toast.success(done);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof HttpError ? error.message : 'انجام این عملیات ممکن نشد.'
      );
    } finally {
      setBusyId(null);
    }
  };

  if (forms.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        هنوز فرمی با این مشخصات ساخته نشده است.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>عنوان فرم</TableHead>
            <TableHead>نوع</TableHead>
            <TableHead>وضعیت</TableHead>
            <TableHead>پرسش‌ها</TableHead>
            <TableHead>پاسخ‌ها</TableHead>
            <TableHead>تاریخ ساخت</TableHead>
            <TableHead>آخرین تغییر</TableHead>
            <TableHead>سازنده</TableHead>
            <TableHead className="text-end">عملیات</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {forms.map((form) => (
            <TableRow key={form.id} data-busy={busyId === form.id || undefined}>
              <TableCell className="font-medium">
                <Link href={`/forms/${form.id}/edit`} className="hover:text-primary">
                  {form.title}
                </Link>
                {form.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs font-normal text-muted-foreground">
                    {form.description}
                  </p>
                )}
              </TableCell>
              <TableCell className="text-xs">{CATEGORY[form.category] ?? form.category}</TableCell>
              <TableCell>
                <Badge variant={STATUS[form.status].variant}>{STATUS[form.status].label}</Badge>
              </TableCell>
              <TableCell>{toPersianDigits(form.questionCount)}</TableCell>
              <TableCell>{toPersianDigits(form.responseCount)}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {formatJalaliDate(form.createdAt)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {formatJalaliDate(form.updatedAt)}
              </TableCell>
              <TableCell>
                {/* rtl-ok: a username is Latin-only, so it reads left-to-right. */}
                <span dir="ltr" className="font-mono text-xs">
                  {form.ownerUsername}
                </span>
              </TableCell>

              <TableCell className="text-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`عملیات ${form.title}`}
                      disabled={busyId === form.id}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-56">
                    {canEdit && (
                      <DropdownMenuItem asChild>
                        <Link href={`/forms/${form.id}/edit`}>
                          <Pencil className="size-4 me-2" />
                          ویرایش
                        </Link>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem asChild>
                      <Link href={`/forms/${form.id}/edit?tab=preview`}>
                        <Eye className="size-4 me-2" />
                        پیش‌نمایش
                      </Link>
                    </DropdownMenuItem>

                    {canPublish && (
                      <DropdownMenuItem onSelect={() => setSharing(form)}>
                        <Share2 className="size-4 me-2" />
                        {form.status === 'PUBLISHED' ? 'اشتراک‌گذاری' : 'انتشار'}
                      </DropdownMenuItem>
                    )}

                    {canSeeResponses && (
                      <DropdownMenuItem asChild>
                        <Link href={`/forms/${form.id}/responses`}>
                          <BarChart3 className="size-4 me-2" />
                          پاسخ‌ها
                        </Link>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    {canCreate && (
                      <DropdownMenuItem
                        onSelect={() =>
                          void run(form.id, () => formsApi.duplicate(form.id), 'رونوشت ساخته شد')
                        }
                      >
                        <Copy className="size-4 me-2" />
                        ساخت رونوشت
                      </DropdownMenuItem>
                    )}

                    {canDelete && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleting(form)}
                      >
                        <Trash2 className="size-4 me-2" />
                        حذف
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sharing && (
        <ShareDialog
          key={sharing.id}
          form={sharing}
          open
          onOpenChange={(open) => !open && setSharing(null)}
        />
      )}

      {/* Deleting takes the answers with it, so it asks first and says so. */}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حذف فرم</DialogTitle>
            <DialogDescription>
              «{deleting?.title}» و {toPersianDigits(deleting?.responseCount ?? 0)} پاسخ ثبت‌شدهٔ
              آن برای همیشه حذف می‌شوند. اگر فقط می‌خواهید دیگر در دسترس نباشد، آن را بایگانی
              کنید.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              loading={busyId === deleting?.id}
              onClick={() => {
                const target = deleting;
                if (!target) return;
                setDeleting(null);
                void run(target.id, () => formsApi.remove(target.id), 'فرم حذف شد');
              }}
            >
              حذف قطعی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
