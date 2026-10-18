import { HttpError } from '@/services';

/**
 * The panel's wording for errors the API shares with the app. Those answer in
 * the app's informal voice; the panel speaks formally, so it swaps them by
 * `code`. Errors only the panel can trigger already arrive formal.
 */
const FORMAL_MESSAGES: Record<string, string> = {
  INTERNAL_ERROR: 'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.',
  RATE_LIMITED: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  OTP_RATE_LIMITED: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  OTP_LOCKED: 'تعداد تلاش‌ها بیش از حد مجاز است. لطفاً کمی بعد کد جدید دریافت کنید.',
  OTP_INVALID: 'کد واردشده اشتباه است.',
  OTP_EXPIRED: 'کد منقضی شده است. لطفاً کد جدید دریافت کنید.',
  OTP_NOT_FOUND: 'برای این شماره کدی ارسال نشده است. لطفاً کد جدید دریافت کنید.',
  SMS_UNAVAILABLE: 'ارسال پیامک در حال حاضر امکان‌پذیر نیست. لطفاً کمی بعد دوباره تلاش کنید.',
  CSRF_REJECTED: 'این درخواست از منبع نامعتبر ارسال شده و پذیرفته نشد.',
  UNAUTHORIZED: 'نشست شما به پایان رسیده است. لطفاً دوباره وارد شوید.',
  FORBIDDEN: 'شما به این بخش دسترسی ندارید.',
};

/** The line to show when a call fails, including when the request never arrives. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpError) return FORMAL_MESSAGES[error.code] ?? error.message;
  return 'ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.';
}

/** The API's stable error `code`, for a screen that reacts to one in particular. */
export function errorCode(error: unknown): string | null {
  return error instanceof HttpError ? error.code : null;
}

/** Per-field messages from a 400 `VALIDATION_ERROR`, keyed by field name. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof HttpError)) return {};
  const details = error.details as { fields?: Record<string, string> } | undefined;
  return details?.fields ?? {};
}
