'use client';

import { useState, type FormEvent } from 'react';
import { CircleAlert, LogOut, MonitorSmartphone, Search } from 'lucide-react';
import { toast } from 'sonner';

import type { AppUserSession } from '@hamdastan/types';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

import { errorMessage, formatDateTime } from '@/lib';

import { useAppUserSessions } from '../hooks/use-app-user-sessions';
import { describeDevice } from '../utils/device';

/** What the confirmation dialog is about to end: one session, or all of them. */
type Pending = { kind: 'one'; session: AppUserSession } | { kind: 'all' } | null;

/**
 * نشست‌های کاربران — a product account's live sign-ins, and ending them.
 *
 * Found by number. Ending a session takes effect on that device's very next
 * request; the API records that an admin ended it, and logs which one.
 */
export function SessionsScreen() {
  const { result, loading, error, lookup, revoke, revokeAll } = useAppUserSessions();
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    await lookup(phone);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'one') {
        await revoke(pending.session.id);
        toast.success('نشست بسته شد');
      } else {
        const count = await revokeAll();
        toast.success(`${toPersianDigits(count)} نشست بسته شد`);
      }
      setPending(null);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const name = result
    ? [result.user.firstName, result.user.lastName].filter(Boolean).join(' ') || 'بدون نام'
    : '';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">نشست‌های کاربران</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          دستگاه‌هایی که یک کاربر اپلیکیشن الان باهاشون وارد شده رو ببین و هر کدوم رو که لازمه ببند.
        </p>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="p-4">
          <form onSubmit={search} className="flex flex-wrap items-end gap-3" noValidate>
            <div className="flex w-full flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="session-phone">شماره موبایل کاربر</Label>
              <Input
                id="session-phone"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'session-error' : undefined}
              />
            </div>
            <Button type="submit" loading={loading}>
              <Search aria-hidden="true" />
              جستجو
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4" id="session-error">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>کاربری پیدا نشد</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="gap-0 py-0">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                {name}
                {result.user.suspended && <Badge variant="secondary">معلق</Badge>}
              </p>
              <p dir="ltr" className="text-end text-sm tabular-nums text-muted-foreground">
                {toPersianDigits(result.user.phone)}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={result.sessions.length === 0}
              onClick={() => setPending({ kind: 'all' })}
              className="text-destructive"
            >
              <LogOut aria-hidden="true" />
              بستن همه‌ی نشست‌ها
            </Button>
          </CardContent>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-3 sm:ps-4">دستگاه</TableHead>
                <TableHead className="hidden md:table-cell">آی‌پی</TableHead>
                <TableHead className="hidden sm:table-cell">ورود</TableHead>
                <TableHead>آخرین فعالیت</TableHead>
                <TableHead className="hidden lg:table-cell">پایان قطعی</TableHead>
                <TableHead className="pe-2 text-end sm:pe-4">
                  <span className="sr-only">عملیات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <MonitorSmartphone aria-hidden="true" className="size-8" />
                      نشست فعالی نداره
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {result.sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="ps-3 font-medium sm:ps-4">{describeDevice(session.userAgent)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span dir="ltr" className="tabular-nums text-muted-foreground">
                      {session.ip ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDateTime(session.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(session.lastSeenAt ?? session.createdAt)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {formatDateTime(session.absoluteExpiresAt)}
                  </TableCell>
                  <TableCell className="pe-2 text-end sm:pe-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPending({ kind: 'one', session })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      بستن
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && setPending(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{pending?.kind === 'all' ? 'بستن همه‌ی نشست‌ها' : 'بستن نشست'}</DialogTitle>
            <DialogDescription>
              {pending?.kind === 'all'
                ? `«${name}» از همه‌ی دستگاه‌هاش خارج می‌شه و برای ادامه باید دوباره وارد بشه.`
                : `«${name}» از «${pending?.kind === 'one' ? describeDevice(pending.session.userAgent) : ''}» خارج می‌شه. بقیه‌ی دستگاه‌هاش دست‌نخورده می‌مونن.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                انصراف
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={confirm} loading={busy}>
              ببند
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
