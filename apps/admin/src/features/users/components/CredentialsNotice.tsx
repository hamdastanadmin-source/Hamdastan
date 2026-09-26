'use client';

import { MessageSquare, TriangleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@hamdastan/ui';
import type { CreateAdminUserResponse } from '@hamdastan/types';

/**
 * What to tell an admin after credentials have been issued.
 *
 * Three things can have happened, and the difference matters:
 *
 *   - the SMS went out, which is the normal case and the end of it;
 *   - the SMS did not go out, and the answer is to reset again later, because
 *     the password cannot be read back and re-sent;
 *   - there is no SMS gateway wired up at all, so the backend echoed the
 *     password into the response for development. That only ever happens
 *     outside production — `SHOW_DEV_CREDENTIALS` is ignored there — and this
 *     is the one place in the panel a password is ever shown.
 */
export function CredentialsNotice({ result }: { result: CreateAdminUserResponse }) {
  return (
    <div className="space-y-3">
      <Alert variant={result.smsDelivered ? 'default' : 'destructive'}>
        {result.smsDelivered ? (
          <MessageSquare className="size-4" />
        ) : (
          <TriangleAlert className="size-4" />
        )}
        <AlertTitle>
          {result.smsDelivered
            ? 'اطلاعات ورود پیامک شد'
            : 'ارسال پیامک ناموفق بود'}
        </AlertTitle>
        <AlertDescription>
          {result.smsDelivered
            ? `نام کاربری و رمز عبور موقت به شمارهٔ ${result.user.mobile} ارسال شد. این کاربر در اولین ورود باید رمز خود را تغییر دهد.`
            : 'حساب ساخته شد، اما پیامک ارسال نشد. برای ارسال دوبارهٔ اطلاعات، رمز موقت را بازنشانی کنید — رمز قبلی قابل بازیابی نیست.'}
        </AlertDescription>
      </Alert>

      {result.temporaryPassword && (
        <Alert variant="warning">
          <TriangleAlert className="size-4" />
          <AlertTitle>رمز عبور موقت (فقط محیط توسعه)</AlertTitle>
          <AlertDescription className="space-y-1">
            {/* rtl-ok: a credential pair is read left-to-right. */}
            <p dir="ltr" className="font-mono text-base">
              {result.user.username} / {result.temporaryPassword}
            </p>
            <p className="text-xs">
              چون هنوز سرویس پیامکی متصل نیست، رمز موقت اینجا نمایش داده می‌شود. در
              محیط production هرگز نمایش داده نمی‌شود.
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
