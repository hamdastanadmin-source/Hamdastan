import { describe, expect, it } from 'vitest';

import { formatPhone, HttpError, toPersianDigits } from '@hamdastan/shared';
import { z } from '@hamdastan/validation';

import {
  formatCountdown,
  sanitizePhoneInput,
  secondsUntil,
  toAuthError,
} from '../utils/auth.utils';

/** What the login screens render, and how a failed call becomes a message. */

describe('sanitizePhoneInput', () => {
  it('reduces every spelling of one number to the same eleven digits', () => {
    for (const raw of [
      '09123456789',
      '+98 912 345 6789',
      '00989123456789',
      '9123456789',
      '0912-345-6789',
      '۰۹۱۲۳۴۵۶۷۸۹',
    ]) {
      expect(sanitizePhoneInput(raw), raw).toBe('09123456789');
    }
  });

  it('caps the value at eleven digits, however many are typed', () => {
    expect(sanitizePhoneInput('091234567890000')).toBe('09123456789');
    expect(sanitizePhoneInput('۰۹۱۲۳۴۵۶۷۸۹۹۹')).toBe('09123456789');
  });

  it('normalises before capping, so a pasted +98 number is not truncated', () => {
    // The bug this guards: capping the raw text first turns
    // "+98 912 345 6789" into "+98 912 34" and then into a seven-digit number.
    expect(sanitizePhoneInput('+98 912 345 6789')).toBe('09123456789');
  });

  it('drops anything that is not a digit', () => {
    expect(sanitizePhoneInput('abc09123456789xyz')).toBe('09123456789');
    expect(sanitizePhoneInput('')).toBe('');
  });

  it('leaves a half-typed number alone so the field stays usable', () => {
    expect(sanitizePhoneInput('0912')).toBe('0912');
  });
});

describe('display helpers', () => {
  it('writes digits in Persian without turning them into a quantity', () => {
    expect(toPersianDigits('123456')).toBe('۱۲۳۴۵۶');
    // No thousands separator: this is a code, not a number.
    expect(toPersianDigits(120)).toBe('۱۲۰');
  });

  it('groups a mobile number the way it is read aloud', () => {
    expect(formatPhone('09123456789')).toBe('۰۹۱۲ ۳۴۵ ۶۷۸۹');
  });

  it('leaves a number it does not recognise ungrouped', () => {
    expect(formatPhone('0912')).toBe('۰۹۱۲');
  });

  it('counts a two-minute code down in minutes and seconds', () => {
    expect(formatCountdown(120)).toBe('۲:۰۰');
    expect(formatCountdown(59)).toBe('۰:۵۹');
    expect(formatCountdown(0)).toBe('۰:۰۰');
  });

  it('never counts below zero, however late the tick arrives', () => {
    expect(formatCountdown(-5)).toBe('۰:۰۰');
    expect(secondsUntil(new Date(Date.now() - 10_000).toISOString())).toBe(0);
  });

  it('rounds a deadline up, so the last second is still shown', () => {
    const now = Date.now();
    expect(secondsUntil(new Date(now + 1_500).toISOString(), now)).toBe(2);
  });
});

describe('toAuthError', () => {
  it('keeps the backend code and message, and files it under the right field', () => {
    const error = toAuthError(
      new HttpError(400, { code: 'OTP_INVALID', message: 'کد وارد‌شده نادرست است.' })
    );

    expect(error).toEqual({
      code: 'OTP_INVALID',
      message: 'کد وارد‌شده نادرست است.',
      field: 'code',
    });
  });

  it('files a phone problem under the phone field even from another step', () => {
    const error = toAuthError(
      new HttpError(400, {
        code: 'PHONE_ALREADY_REGISTERED',
        message: 'این شماره قبلاً ثبت‌نام شده است. وارد شوید.',
      }),
      'form'
    );

    expect(error.field).toBe('phone');
  });

  it('keeps an unrecognised code under the field the caller named', () => {
    const error = toAuthError(
      new HttpError(429, { code: 'OTP_RESEND_LIMIT', message: 'بیش از حد مجاز' }),
      'code'
    );

    expect(error).toMatchObject({ code: 'OTP_RESEND_LIMIT', field: 'code' });
  });

  it('says the request never arrived when fetch itself failed', () => {
    const error = toAuthError(new TypeError('Failed to fetch'), 'phone');

    expect(error.code).toBeUndefined();
    expect(error.message).toContain('ارتباط با سرور');
    expect(error.field).toBe('phone');
  });

  it('reports a local schema rejection under the field being edited', () => {
    const rejected = z.object({ phone: z.string().min(11, 'شماره کوتاه است') }).safeParse({
      phone: '0912',
    });

    const error = toAuthError(rejected.error, 'phone');

    expect(error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'شماره کوتاه است',
      field: 'phone',
    });
  });

  it('falls back to something readable for anything else', () => {
    const error = toAuthError('boom');

    expect(error.message).toBeTruthy();
    expect(error.field).toBe('form');
  });
});
