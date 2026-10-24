'use client';

import { IMAGE_FRAMES, WORLD_LIMITS, WORLD_THEME_LABELS, WORLD_THEMES } from '@hamdastan/config';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Input, Textarea, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { NEUTRAL_TOGGLE } from '@/components';
import { MediaField } from '@/features/media';

import type { WorldForm } from './types';

/** «هویت»: the name, the words and the pictures a world is known by, and its look. */
export function IdentityTab({ form }: { form: WorldForm }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>نام</FormLabel>
              <FormControl>
                <Input {...field} maxLength={WORLD_LIMITS.NAME_MAX} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>نامک</FormLabel>
              <FormControl>
                <Input {...field} dir="ltr" autoComplete="off" />
              </FormControl>
              <FormDescription>بخشی از نشانی صفحه‌ی دنیا. تغییرش لینک‌های قبلی را از کار می‌اندازد.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tagline"
          render={({ field }) => (
            <FormItem>
              <FormLabel>شعار</FormLabel>
              <FormControl>
                <Input {...field} maxLength={WORLD_LIMITS.TAGLINE_MAX} />
              </FormControl>
              <FormDescription>یک خط زیر نام دنیا، بالای صفحه‌اش.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>معرفی کوتاه</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} maxLength={WORLD_LIMITS.SUMMARY_MAX} />
              </FormControl>
              <FormDescription>زیر نام دنیا، وقتی شعاری نوشته نشده. برای انتشار لازم است.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>توضیح کامل</FormLabel>
              <FormControl>
                <Textarea {...field} rows={8} maxLength={WORLD_LIMITS.DESCRIPTION_MAX} />
              </FormControl>
              <FormDescription>متن ساده؛ هر خط خالی یک پاراگراف تازه شروع می‌کند.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-col gap-5">
        <FormField
          control={form.control}
          name="coverId"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>کاور</FormLabel>
              <MediaField
                value={field.value}
                onChange={field.onChange}
                kind="image"
                category="cover"
                pickerTitle="کاور دنیا"
                invalid={Boolean(fieldState.error)}
                frame={IMAGE_FRAMES.worldCover}
              />
              <FormDescription>بالای صفحه‌ی دنیا و بنر آن در خانه‌ی اپلیکیشن. اگر خالی بماند، تصویر پیش‌فرض دنیا (یا یک کادر ساده) نمایش داده می‌شود.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="theme"
          render={({ field }) => (
            <FormItem>
              <FormLabel>تم</FormLabel>
              <ToggleGroup
                type="single"
                value={field.value}
                onValueChange={(next) => next && field.onChange(next)}
                spacing={2}
                className="flex-wrap"
                aria-label="تم دنیا"
              >
                {WORLD_THEMES.map((theme) => (
                  <ToggleGroupItem key={theme} value={theme} className={NEUTRAL_TOGGLE}>
                    {WORLD_THEME_LABELS[theme]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FormDescription>رنگ‌مایه‌ی صفحه‌ی دنیا در اپلیکیشن؛ از رنگ‌های آماده‌ی طراحی، تا در حالت روشن و تیره خوانا بماند.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
