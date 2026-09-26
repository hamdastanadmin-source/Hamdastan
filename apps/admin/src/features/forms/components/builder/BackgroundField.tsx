'use client';

import { useRef, useState } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';

import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_MAX_BYTES,
} from '@hamdastan/validation';
import { Button, resolveAssetUrl } from '@hamdastan/ui';

import { HttpError } from '@/services';

import { formsApi } from '../../services/forms.api';

/**
 * The background behind a question, uploaded from the author's machine.
 *
 * The file goes to **our backend** and nowhere else: it is read in the browser,
 * sent as base64 to `POST /admin/forms/:id/assets`, and what comes back is a
 * URL the question stores. The bytes never travel with the form document, and
 * no third-party uploader is involved.
 *
 * The checks here — type and size — are the same ones the backend applies, so
 * an obviously wrong file is refused before a megabyte crosses the wire; the
 * backend is what decides.
 */
export function BackgroundField({
  formId,
  value,
  onChange,
}: {
  formId: string;
  value: string | undefined;
  onChange: (url: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The API serves the image, so a stored path needs its origin to render. */
  const preview = value ? resolveAssetUrl(value) : undefined;

  const upload = async (file: File) => {
    setError(null);

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError('فقط تصویر با فرمت PNG، JPEG، WEBP یا GIF مجاز است.');
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError(`حجم تصویر باید کمتر از ${Math.round(IMAGE_MAX_BYTES / 1024 / 1024)} مگابایت باشد.`);
      return;
    }

    setUploading(true);

    try {
      const data = await toBase64(file);
      const { url } = await formsApi.uploadAsset(formId, {
        filename: file.name,
        contentType: file.type,
        data,
      });
      onChange(url);
    } catch (caught) {
      setError(
        caught instanceof HttpError ? caught.message : 'بارگذاری تصویر ممکن نشد.'
      );
    } finally {
      setUploading(false);
      // Clearing it means choosing the same file twice still fires `change`.
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">پس‌زمینهٔ پرسش</p>

      {preview && (
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- the URL is
              an arbitrary upload served by our own API, not a known asset. */}
          <img src={preview} alt="پیش‌نمایش پس‌زمینه" className="h-24 w-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            aria-label="حذف پس‌زمینه"
            className="absolute end-2 top-2"
            onClick={() => onChange(undefined)}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      )}

      {/* The native control renders "Choose File" in the browser's language
          and ignores `dir`; the input stays, behind a button that does not. */}
      <input
        ref={input}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        disabled={uploading}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        loading={uploading}
        onClick={() => input.current?.click()}
      >
        <ImageUp className="size-4" />
        {value ? 'تغییر تصویر' : 'انتخاب تصویر'}
      </Button>

      <p className="text-xs text-muted-foreground">
        {`PNG، JPEG، WEBP یا GIF — حداکثر ${Math.round(IMAGE_MAX_BYTES / 1024 / 1024)} مگابایت`}
      </p>

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

/** The file as base64, without the `data:` prefix the backend does not want. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}
