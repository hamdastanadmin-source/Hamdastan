'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { ADMIN_ERROR_CODES, type AdminUser } from '@hamdastan/types';
import { toMobileInput } from '@hamdastan/shared/format/persian';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hamdastan/ui';
import {
  adminUserCreateSchema,
  type AdminUserCreateInput,
  type AdminUserCreateOutput,
} from '@hamdastan/validation';

import { errorCode, errorMessage, fieldErrors } from '@/lib';

type UserFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The user being edited; absent when creating one. */
  user?: AdminUser;
  /** Editing yourself: the status cannot be changed, so you cannot lock yourself out. */
  isSelf?: boolean;
  onSubmit: (fields: AdminUserCreateOutput) => Promise<unknown>;
};

const FIELDS = ['firstName', 'lastName', 'phone', 'status'] as const;

/**
 * Create or edit an admin user. The same schema as the API, so a value the
 * form accepts is one the server accepts; what only the server can know — a
 * number someone else already has — comes back and lands under its field.
 *
 * The parent remounts this per user (by `key`), which resets the form.
 */
export function UserFormDialog({ open, onOpenChange, user, isSelf, onSubmit }: UserFormDialogProps) {
  const form = useForm<AdminUserCreateInput, unknown, AdminUserCreateOutput>({
    resolver: zodResolver(adminUserCreateSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      status: user?.status ?? 'active',
    },
  });

  const submit = form.handleSubmit(async (fields) => {
    try {
      await onSubmit(fields);
      toast.success(user ? 'تغییرات ذخیره شد' : 'کاربر جدید ثبت شد');
      onOpenChange(false);
    } catch (error) {
      if (errorCode(error) === ADMIN_ERROR_CODES.ADMIN_PHONE_TAKEN) {
        form.setError('phone', { message: errorMessage(error) }, { shouldFocus: true });
        return;
      }
      const byField = fieldErrors(error);
      const known = FIELDS.filter((field) => byField[field]);
      if (known.length > 0) {
        for (const field of known) form.setError(field, { message: byField[field] });
        return;
      }
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'ویرایش کاربر' : 'کاربر جدید'}</DialogTitle>
          <DialogDescription>
            این کاربر با همین شماره و کد یک‌بارمصرف وارد پنل مدیریت می‌شه.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="admin-user-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام خانوادگی</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>شماره موبایل</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      dir="ltr"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="09123456789"
                      className="tabular-nums"
                      onChange={(event) => field.onChange(toMobileInput(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>وضعیت</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSelf}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">فعال</SelectItem>
                      <SelectItem value="inactive">غیرفعال</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {isSelf
                      ? 'وضعیت حساب خودت رو نمی‌تونی تغییر بدی.'
                      : 'کاربر غیرفعال نمی‌تونه وارد بشه و نشست‌های بازش بسته می‌شه.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              انصراف
            </Button>
          </DialogClose>
          <Button type="submit" form="admin-user-form" loading={form.formState.isSubmitting}>
            {user ? 'ذخیره تغییرات' : 'ثبت کاربر'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
