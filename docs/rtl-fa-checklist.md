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
- `DirectionProvider` در ریشه‌ی `layout.tsx` قرار دارد. Radix محتوای portal‌شده را
  بیرون از زیردرختِ `dir="rtl"` رندر می‌کند و این Provider جهت را از روی portal
  عبور می‌دهد.

6. فیلدهایی که واقعاً LTR هستند
- شماره موبایل و خانه‌های کد تأیید با `dir="ltr"` رندر می‌شوند: رقم‌ها ترتیب LTR
  خودشان را دارند، حتی در صفحه‌ی RTL.
- قاعده‌ی `input, textarea, select` در `packages/ui/styles/base.css` با
  `:not([dir])` نوشته شده تا اتریبیوت `dir` روی خود فیلد برنده باشد. بدون آن،
  استایل پایه اتریبیوت را بی‌صدا خنثی می‌کرد.

7. ارقام
- هر عددی که کاربر **می‌خواند** با `toPersianDigits` نمایش داده می‌شود (تایمر،
  روز و سال تولد).
- هر عددی که کاربر **تایپ می‌کند** یا سیستم **ذخیره می‌کند** با `toLatinDigits`
  به ۰-۹ لاتین تبدیل می‌شود (شماره موبایل، کد تأیید). هر دو در
  `@hamdastan/shared/format/persian` هستند.

8. تقویم
- تاریخ تولد در تقویم **شمسی** گرفته و نمایش داده می‌شود و به‌صورت میلادی ذخیره
  می‌شود. تبدیل فقط در `@hamdastan/shared/format/jalali` انجام می‌شود.

## Smoke Test

قبل از merge این دستور اجرا شود:

```bash
npm run lint:all
```

خروجی `RTL smoke check passed.` باید دیده شود.

