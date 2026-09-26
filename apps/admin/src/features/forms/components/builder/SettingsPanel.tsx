'use client';

import { Bell, CalendarClock, MessageSquare, Settings2, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import type { AudienceMode, FormCategory, FormSettings } from '@hamdastan/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  JalaliDateField,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@hamdastan/ui';

import type { FormBuilder } from '../../hooks/use-form-builder';

/**
 * Everything about the form that is not a question.
 *
 * Four groups, in the order an author thinks about them: what this form is,
 * when it is open, who may answer, and what happens when somebody does.
 *
 * Every switch here changes behaviour the backend enforces — a closed window
 * refuses answers, «یک پاسخ برای هر کاربر» refuses a second one. The panel
 * writes settings; `apps/api` is what acts on them.
 */

const CATEGORIES: Record<FormCategory, string> = {
  FEEDBACK: 'بازخورد',
  SURVEY: 'نظرسنجی',
  CHECKLIST: 'چک‌لیست',
  REQUEST: 'درخواست',
  ASSESSMENT: 'ارزیابی',
  OTHER: 'سایر',
};

const AUDIENCES: Record<AudienceMode, string> = {
  EVERYONE: 'همهٔ کاربران',
  USERS: 'کاربران انتخاب‌شده',
  ROLES: 'نقش‌های انتخاب‌شده',
  GROUPS: 'گروه‌های انتخاب‌شده',
};

/** The product's own roles — what an audience limited by role can pick from. */
const PRODUCT_ROLES = [
  { value: 'USER', label: 'کاربر عادی' },
  { value: 'ADMIN', label: 'مدیر' },
];

export function SettingsPanel({ builder }: { builder: FormBuilder }) {
  const { form } = builder;
  const settings = form.settings;

  const setSettings = (patch: Partial<FormSettings>) =>
    builder.setSettings({ ...settings, ...patch });

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <Section title="اطلاعات کلی" icon={<Settings2 className="size-4 text-primary" />}>
          <FormField label="عنوان فرم" required>
            <Input
              value={form.title}
              onChange={(event) => builder.setMeta({ title: event.target.value })}
            />
          </FormField>

          <FormField label="توضیح">
            <Textarea
              value={form.description ?? ''}
              onChange={(event) => builder.setMeta({ description: event.target.value })}
              rows={2}
              placeholder="این فرم برای چیست؟"
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="دسته‌بندی">
              <Select
                value={form.category}
                onValueChange={(value) =>
                  builder.setMeta({ category: value as FormCategory })
                }
              >
                <SelectTrigger aria-label="دسته‌بندی">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="سازندهٔ فرم" helperText="پس از ساخت تغییر نمی‌کند.">
              <Input value={form.ownerName} readOnly disabled />
            </FormField>
          </div>
        </Section>

        <Section title="بازهٔ پاسخ‌گویی" icon={<CalendarClock className="size-4 text-primary" />}>
          <ToggleRow
            id="alwaysAvailable"
            label="همیشه باز باشد"
            description="با خاموش کردن این گزینه می‌توانید تاریخ شروع و پایان تعیین کنید."
            checked={settings.availability.alwaysAvailable}
            onChange={(checked) =>
              setSettings({
                availability: { ...settings.availability, alwaysAvailable: checked },
              })
            }
          />

          {!settings.availability.alwaysAvailable && (
            <div className="grid gap-3 sm:grid-cols-2">
              <JalaliDateField
                label="تاریخ شروع"
                value={settings.availability.publishAt ?? ''}
                onChange={(iso) =>
                  setSettings({
                    availability: { ...settings.availability, publishAt: iso },
                  })
                }
              />
              <JalaliDateField
                label="تاریخ پایان"
                value={settings.availability.closeAt ?? ''}
                onChange={(iso) =>
                  setSettings({ availability: { ...settings.availability, closeAt: iso } })
                }
              />
            </div>
          )}
        </Section>

        <Section title="مخاطبان" icon={<Users className="size-4 text-primary" />}>
          <FormField
            label="چه کسانی می‌توانند پاسخ دهند؟"
            helperText="دسترسی در سمت سرور بررسی می‌شود؛ لینک فرم به‌تنهایی دسترسی نمی‌دهد."
          >
            <Select
              value={form.audience.mode}
              onValueChange={(value) =>
                builder.setMeta({ audience: { ...form.audience, mode: value as AudienceMode } })
              }
            >
              <SelectTrigger aria-label="مخاطبان">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AUDIENCES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {form.audience.mode === 'ROLES' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">نقش‌های مجاز</p>
              {PRODUCT_ROLES.map((role) => {
                const roles = form.audience.roles ?? [];
                const checked = roles.includes(role.value);

                return (
                  <label
                    key={role.value}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-sm"
                  >
                    {role.label}
                    <Switch
                      checked={checked}
                      onCheckedChange={(next) =>
                        builder.setMeta({
                          audience: {
                            ...form.audience,
                            roles: next
                              ? [...roles, role.value]
                              : roles.filter((entry) => entry !== role.value),
                          },
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
          )}

          {form.audience.mode === 'USERS' && (
            <FormField
              label="شناسهٔ کاربران"
              helperText="شناسه‌ها را با ویرگول جدا کنید. انتخاب از فهرست کاربران در مرحلهٔ بعد اضافه می‌شود."
            >
              <Input
                value={(form.audience.userIds ?? []).join('، ')}
                onChange={(event) =>
                  builder.setMeta({
                    audience: {
                      ...form.audience,
                      userIds: event.target.value
                        .split(/[,،]/)
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    },
                  })
                }
                // rtl-ok: identifiers are Latin and read left-to-right.
                dir="ltr"
                className="text-start"
              />
            </FormField>
          )}

          {form.audience.mode === 'GROUPS' && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-foreground/80">
              گروه‌ها هنوز به‌عنوان موجودیت در محصول تعریف نشده‌اند، بنابراین این حالت فعلاً
              دسترسی هیچ‌کس را باز نمی‌کند.
            </p>
          )}
        </Section>

        <Section title="پاسخ‌ها" icon={<MessageSquare className="size-4 text-primary" />}>
          <ToggleRow
            id="anonymous"
            label="پاسخ‌ها ناشناس ثبت شوند"
            description="هویت پاسخ‌دهنده ذخیره نمی‌شود."
            checked={settings.responses.anonymous}
            onChange={(checked) =>
              setSettings({ responses: { ...settings.responses, anonymous: checked } })
            }
          />
          <ToggleRow
            id="onePerUser"
            label="هر کاربر فقط یک‌بار پاسخ دهد"
            checked={settings.responses.onePerUser}
            onChange={(checked) =>
              setSettings({ responses: { ...settings.responses, onePerUser: checked } })
            }
          />
          <ToggleRow
            id="allowEdit"
            label="ویرایش پاسخ پس از ثبت مجاز باشد"
            checked={settings.responses.allowEditAfterSubmit}
            onChange={(checked) =>
              setSettings({
                responses: { ...settings.responses, allowEditAfterSubmit: checked },
              })
            }
          />
          <ToggleRow
            id="showProgress"
            label="نوار پیشرفت به پاسخ‌دهنده نشان داده شود"
            checked={settings.showProgress}
            onChange={(checked) => setSettings({ showProgress: checked })}
          />
        </Section>

        <Section title="اعلان‌ها" icon={<Bell className="size-4 text-primary" />}>
          <ToggleRow
            id="notifyAdmin"
            label="با ثبت هر پاسخ به مدیر اطلاع بده"
            checked={settings.notifications.notifyAdminOnResponse}
            onChange={(checked) =>
              setSettings({
                notifications: { ...settings.notifications, notifyAdminOnResponse: checked },
              })
            }
          />
          <ToggleRow
            id="confirmRespondent"
            label="برای پاسخ‌دهنده تأییدیه بفرست"
            checked={settings.notifications.sendConfirmationToRespondent}
            onChange={(checked) =>
              setSettings({
                notifications: {
                  ...settings.notifications,
                  sendConfirmationToRespondent: checked,
                },
              })
            }
          />
        </Section>

        <Section title="صفحهٔ خوش‌آمد و پایان" icon={<Settings2 className="size-4 text-primary" />}>
          <ToggleRow
            id="welcomeEnabled"
            label="صفحهٔ خوش‌آمد نمایش داده شود"
            checked={settings.welcome.enabled}
            onChange={(checked) =>
              setSettings({ welcome: { ...settings.welcome, enabled: checked } })
            }
          />

          {settings.welcome.enabled && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <FormField label="عنوان خوش‌آمد">
                <Input
                  value={settings.welcome.title}
                  onChange={(event) =>
                    setSettings({ welcome: { ...settings.welcome, title: event.target.value } })
                  }
                />
              </FormField>
              <FormField label="توضیح">
                <Textarea
                  rows={2}
                  value={settings.welcome.description ?? ''}
                  onChange={(event) =>
                    setSettings({
                      welcome: { ...settings.welcome, description: event.target.value },
                    })
                  }
                />
              </FormField>
              <FormField label="متن دکمهٔ شروع">
                <Input
                  value={settings.welcome.buttonLabel}
                  onChange={(event) =>
                    setSettings({
                      welcome: { ...settings.welcome, buttonLabel: event.target.value },
                    })
                  }
                />
              </FormField>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-border p-3">
            <FormField label="پیام پایان">
              <Input
                value={settings.thankYou.title}
                onChange={(event) =>
                  setSettings({ thankYou: { ...settings.thankYou, title: event.target.value } })
                }
              />
            </FormField>
            <FormField label="توضیح پایان">
              <Textarea
                rows={2}
                value={settings.thankYou.description ?? ''}
                onChange={(event) =>
                  setSettings({
                    thankYou: { ...settings.thankYou, description: event.target.value },
                  })
                }
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="متن دکمهٔ پایانی (اختیاری)">
                <Input
                  value={settings.thankYou.buttonLabel ?? ''}
                  onChange={(event) =>
                    setSettings({
                      thankYou: { ...settings.thankYou, buttonLabel: event.target.value },
                    })
                  }
                />
              </FormField>
              <FormField label="نشانی دکمه">
                <Input
                  value={settings.thankYou.buttonUrl ?? ''}
                  onChange={(event) =>
                    setSettings({
                      thankYou: { ...settings.thankYou, buttonUrl: event.target.value },
                    })
                  }
                  placeholder="https://…"
                  // rtl-ok: a URL is read left-to-right.
                  dir="ltr"
                  className="text-start"
                />
              </FormField>
            </div>
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
