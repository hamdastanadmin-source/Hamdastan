'use client';

import { useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

import type { Form } from '@hamdastan/types';
import { Card, CardContent, FormRunner, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

/**
 * The form as a respondent will meet it, at three widths.
 *
 * `FormRunner` is the design system's, and the public page in `apps/web` uses
 * the same component — so this is not an impression of the real thing, it is
 * the real thing with `preview` set, which is the one difference: it walks the
 * pages, checks what is required and shows the thank-you screen, and submits
 * nothing.
 *
 * The device frames are widths rather than pictures of phones: what changes
 * between a desktop and a phone here is how much room the questions get.
 */

const DEVICES = {
  desktop: { label: 'دسکتاپ', icon: Monitor, width: 'max-w-3xl' },
  tablet: { label: 'تبلت', icon: Tablet, width: 'max-w-xl' },
  mobile: { label: 'موبایل', icon: Smartphone, width: 'max-w-sm' },
} as const;

export type PreviewDevice = keyof typeof DEVICES;

export function PreviewPane({
  form,
  device,
  onDeviceChange,
}: {
  form: Form;
  device?: PreviewDevice;
  onDeviceChange?: (device: PreviewDevice) => void;
}) {
  const [local, setLocal] = useState<PreviewDevice>('desktop');
  const current = device ?? local;
  const setDevice = onDeviceChange ?? setLocal;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-muted/30">
      <div className="flex justify-center border-b border-border bg-background/80 p-2">
        <ToggleGroup
          type="single"
          value={current}
          onValueChange={(value) => value && setDevice(value as PreviewDevice)}
        >
          {Object.entries(DEVICES).map(([value, config]) => (
            <ToggleGroupItem key={value} value={value} aria-label={config.label}>
              <config.icon className="size-4" />
              <span className="ms-1.5 hidden text-xs sm:inline">{config.label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex-1 p-4 sm:p-8">
        <div className={`mx-auto w-full transition-all ${DEVICES[current].width}`}>
          <div className="mb-4 space-y-1 text-center">
            <h1 className="text-xl font-bold">{form.title}</h1>
            {form.description && (
              <p className="text-sm text-muted-foreground">{form.description}</p>
            )}
          </div>

          <Card>
            <CardContent className="p-5 sm:p-6">
              {/* Keyed by the document, so editing a question resets the walk
                  instead of leaving the preview on a page that no longer exists. */}
              <FormRunner
                key={`${form.id}-${form.questions.length}-${form.pages.length}`}
                form={form}
                preview
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
