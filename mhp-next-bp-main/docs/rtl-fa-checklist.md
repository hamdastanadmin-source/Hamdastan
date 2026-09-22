# RTL/FA Checklist

این پروژه باید به‌صورت پیش‌فرض فارسی (`fa`) و راست‌به‌چپ (`rtl`) باشد.

## قواعد اجباری

1. ریشه اپ
- در `src/app/layout.tsx` باید `<html lang={APP_LANG} dir={APP_DIR}>` باقی بماند.

2. لایه UI
- وارد کردن مستقیم از `@parto-system-design/ui` در `src/**` ممنوع است.
- فقط از wrapperهای داخلی استفاده شود:
  - `@/components/UiComponents`
  - `@/components/ui/*`

3. کلاس‌های جهت‌محور
- استفاده از utilityهای فیزیکی ممنوع است:
  - `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`
- جایگزین‌ها:
  - `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`

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

