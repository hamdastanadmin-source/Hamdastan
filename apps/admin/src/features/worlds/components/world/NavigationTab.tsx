'use client';

import { useFieldArray } from 'react-hook-form';

import { WORLD_LIMITS, WORLD_SECTION_LABELS } from '@hamdastan/config';
import { FormControl, FormField, FormItem, FormMessage, Input, Switch } from '@hamdastan/ui';

import type { WorldForm } from './types';

/**
 * «منو»: the bar at the bottom of the world's pages — «خانه», always on,
 * and «فعالیت‌ها», which may be switched off. Each takes its own label.
 * News, knowledge and events are sections of the home, set in «خانه».
 */
export function NavigationTab({ form, disabled }: { form: WorldForm; disabled: boolean }) {
  const { fields } = useFieldArray({ control: form.control, name: 'navigation' });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">منوی پایین صفحه‌ی دنیا در اپلیکیشن. اخبار، دانستنی‌ها و رویدادها بخش‌های «خانه»اند و در تب «خانه» چیده می‌شوند.</p>
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
