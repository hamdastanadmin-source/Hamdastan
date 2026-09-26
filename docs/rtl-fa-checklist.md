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
  - `text-left`, `text-right`, `float-left`, `float-right` (با variant هم: `sm:text-left`)
- جایگزین‌ها:
  - `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`
- چرا مهم است: یک `text-left` روی `th` باعث می‌شود تیتر ستون سمت چپ بنشیند و
  دادهٔ راست‌چین زیرش قرار نگیرد — همان چیزی که در جدول‌ها دیده می‌شد.
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
- **هر کامپوننت Radix که رفتارش به جهت وابسته است باید `dir` بگیرد**، نه فقط
  Overlayها. `Slider` نمونهٔ روشن آن است: بدون `dir` پرشدن نوار از لبهٔ اشتباه
  شروع می‌شود و ۰ تا ۱۰۰ برعکس می‌شود. wrapperهای جهت‌دار در
  `packages/ui/components/index.tsx` جمع‌اند؛ اگر کامپوننتی از
  `primitives/` مستقیم import شود، wrapper دور زده می‌شود.
- تاریخ را با `JalaliDateField` / `JalaliDateSelect` بگیرید، نه
  `<input type="date">` — کنترل بومی مرورگر تقویم و زبان خودش را نشان می‌دهد.
- برای انتخاب فایل از دکمهٔ فارسی استفاده کنید؛ `<input type="file">` متن
  «Choose File» را به زبان مرورگر نشان می‌دهد و `dir` را نادیده می‌گیرد.

6. ساختار سند
- در هر صفحه دقیقاً **یک** `<main id="main-content">` وجود داشته باشد. اگر
  shell اپ آن را می‌سازد، صفحه نباید یکی دیگر بسازد (و برعکس).

## Smoke Test

قبل از merge این دستور اجرا شود:

```bash
npm run lint:all
```

خروجی `RTL smoke check passed.` باید دیده شود.

