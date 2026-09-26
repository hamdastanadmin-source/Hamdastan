import type { Metadata } from 'next';
import Link from 'next/link';
import { KeyRound, ShieldCheck, Users } from 'lucide-react';

import { APP_NAME } from '@hamdastan/config';
import { hasAdminPermission } from '@hamdastan/shared/rbac';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hamdastan/ui';

import { requireAdmin } from '@/features/auth/server';

/**
 * The dashboard.
 *
 * Deliberately thin: this stage of the product is authentication and user
 * management, so the dashboard says who is signed in and points at the one
 * place there is to go. Figures belong here when there is something to count.
 */

export const metadata: Metadata = {
  title: `داشبورد | پنل مدیریت ${APP_NAME}`,
};

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const canSeeUsers = hasAdminPermission(admin.permissions, 'users.view');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          خوش آمدید، {admin.fullName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          شما با نقش «{admin.roleName}» وارد شده‌اید.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <ShieldCheck className="size-5 text-primary" />
            <CardTitle className="text-base">دسترسی‌های شما</CardTitle>
            <CardDescription>
              نقش شما {admin.permissions.length} دسترسی دارد. منوهای سمت راست بر
              همین اساس نمایش داده می‌شوند.
            </CardDescription>
          </CardHeader>
        </Card>

        {canSeeUsers && (
          <Card className="transition-colors hover:border-primary/40">
            <Link href="/users">
              <CardHeader className="space-y-1">
                <Users className="size-5 text-primary" />
                <CardTitle className="text-base">مدیریت کاربران</CardTitle>
                <CardDescription>
                  ساخت کاربر ادمین، تغییر نقش و اعتبار دسترسی، و بازنشانی رمز موقت.
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-1">
            <KeyRound className="size-5 text-primary" />
            <CardTitle className="text-base">رمز عبور</CardTitle>
            <CardDescription>
              رمز عبور کاربران قابل بازیابی نیست. در صورت فراموشی، رمز موقت جدیدی
              ساخته و پیامک می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  );
}
