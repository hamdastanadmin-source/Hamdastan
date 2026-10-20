'use client';

import { useFieldArray } from 'react-hook-form';
import { ArrowDown, ArrowUp } from 'lucide-react';

import { WORLD_LIMITS, WORLD_SECTION_LABELS } from '@hamdastan/config';
import { Button, FormControl, FormField, FormItem, FormMessage, Input, Switch } from '@hamdastan/ui';

import type { WorldForm } from './types';

/**
 * «منو»: the tabs of the world's page, in order, each with its label and
 * on or off. «خانه» is always first and on. A tab that is off takes its
 * section off the world's home too — that is how a world «does not have»
 * news, events or activities.
 */
export function NavigationTab({ form, disabled }: { form: WorldForm; disabled: boolean }) {
  const { fields, move } = useFieldArray({ control: form.control, name: 'navigation' });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">ترتیب این فهرست، ترتیب تب‌های صفحه‌ی دنیا در اپلیکیشن است.</p>
      <ol className="flex flex-col gap-2">
        {fields.map((item, index) => {
          const home = item.section === 'home';
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <span className="w-24 shrink-0 text-sm font-medium">{WORLD_SECTION_LABELS[item.section]}</span>
              <FormField
                control={form.control}
                name={`navigation.${index}.label`}
                render={({ field }) => (
                  <FormItem className="min-w-40 flex-1">
                    <FormControl>
                      <Input {...field} maxLength={WORLD_LIMITS.NAV_LABEL_MAX} aria-label={`برچسب «${WORLD_SECTION_LABELS[item.section]}» در منو`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`navigation.${index}.enabled`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={disabled || home}
                        aria-label={`نمایش «${WORLD_SECTION_LABELS[item.section]}»`}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || home || index <= 1}
                  onClick={() => move(index, index - 1)}
                  aria-label={`بالا بردن «${WORLD_SECTION_LABELS[item.section]}»`}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || home || index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={`پایین بردن «${WORLD_SECTION_LABELS[item.section]}»`}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      <FormField
        control={form.control}
        name="navigation"
        render={() => (
          <FormItem>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
