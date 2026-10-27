'use client';

import Image from 'next/image';
import { Share, SquarePlus } from 'lucide-react';

import { Button, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@hamdastan/ui';

import { useInstallOffer } from '../hooks/use-install-offer';

/**
 * «هم‌داستان رو نصب کن» — a bottom sheet that rises a moment after a screen
 * worth coming back to. Where the browser can install, «نصب» opens its
 * dialog; on iPhone, where it cannot, the sheet shows Safari's two steps.
 * Nothing appears on a device that cannot install, or already has.
 */
export function InstallAppSheet() {
  const { method, open, dismiss, install } = useInstallOffer();
  if (!method) return null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && dismiss()}>
      <SheetContent
        // rtl-ok: `side` names the physical edge the sheet rises from.
        side="bottom"
        showCloseButton={false}
        className="rounded-t-3xl border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <SheetHeader className="items-center px-5 pt-6 text-center">
          <Image src="/icons/icon-192.png" alt="" width={64} height={64} className="rounded-2xl border" />
          <SheetTitle className="text-lg">هم‌داستان رو نصب کن</SheetTitle>
          <SheetDescription>
            مثل یه اپ روی صفحه‌ی گوشیت؛ یه لمس تا ادامه‌ی ماجرا، بدون گشتن دنبال لینک.
          </SheetDescription>
        </SheetHeader>
        {method === 'ios' && (
          <ol className="flex flex-col gap-3 px-5 text-sm">
            <li className="flex items-center gap-3 rounded-xl border p-3">
              <Share aria-hidden="true" className="size-5 shrink-0" />
              توی سافاری، دکمه‌ی «اشتراک‌گذاری» رو بزن.
            </li>
            <li className="flex items-center gap-3 rounded-xl border p-3">
              <SquarePlus aria-hidden="true" className="size-5 shrink-0" />
              «Add to Home Screen» رو انتخاب کن.
            </li>
          </ol>
        )}
        <SheetFooter className="px-5 pb-5">
          {method === 'prompt' ? (
            <>
              <Button size="xl" className="w-full" onClick={() => void install()}>
                نصب
              </Button>
              <Button size="xl" variant="ghost" className="w-full" onClick={dismiss}>
                بعداً
              </Button>
            </>
          ) : (
            <Button size="xl" variant="outline" className="w-full" onClick={dismiss}>
              فهمیدم
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
