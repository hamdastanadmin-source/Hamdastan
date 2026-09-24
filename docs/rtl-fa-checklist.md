# RTL/FA Checklist

این پروژه باید به‌صورت پیش‌فرض فارسی (`fa`) و راست‌به‌چپ (`rtl`) باشد.

## قواعد اجباری

1. ریشه اپ
- در `apps/web/src/app/layout.tsx` و `apps/admin/src/app/layout.tsx` باید `<html lang={APP_LANG} dir={APP_DIR}>` باقی بماند.

2. لایه UI
- وارد کردن مستقیم پریمیتیوهای Radix (`radix-ui`, `@radix-ui/*`) خارج از `packages/ui/primitives` ممنوع است.
- فقط از wrapperهای داخلی استفاده شود:
  - `@hamdastan/ui`

3. کلاس‌های جهت‌محور
- استفاده از utilityهای فیزیکی ممنوع است:
  - `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`
- جایگزین‌ها:
  - `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`
- استثنا: جایی که جهت فیزیکی واقعاً درست است (وسط‌چین کردن با `translate`، یا
  APIای مثل `side` در `Sheet` که خودش نام یک لبه‌ی فیزیکی است)، یک کامنت
  `rtl-ok: <دلیل>` روی همان خط یا خط قبلش گذاشته شود.

4. متن‌های ترکیبی (فارسی + عدد/لاتین)
- برای جلوگیری از به‌هم‌ریختگی bidi از `unicode-bidi: plaintext` استفاده شود:
  - کلاس `bidi-plaintext`
  - یا `[unicode-bidi:plaintext]`

5. کامپوننت‌های حساس
- `Tabs` باید از wrapper داخلی باشد تا رفتار RTL پیش‌فرض داشته باشد.
- برای Overlayها (`SelectContent`, `PopoverContent`, `DropdownMenuContent`) جهت پیش‌فرض RTL حفظ شود.

## Smoke Test

قبل از merge این دستور اجرا شود:

```bash
npm run lint:all
```

خروجی `RTL smoke check passed.` باید دیده شود.

