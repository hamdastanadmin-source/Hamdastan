'use client';

import { useRouter } from 'next/navigation';
import { CircleAlert, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { NOTIFICATION_CATEGORY_LABELS } from '@hamdastan/config';
import type { NotificationPreferences } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle, Button } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';
import { ListGroup, ListRow, SettingSwitch } from '@/features/profile';
import { HttpError } from '@/services';

import { usePreferences } from '../hooks/use-preferences';
import { usePushDevice, type PushDeviceState } from '../hooks/use-push-device';
import { CATEGORY_ICONS, PREFERENCE_HINTS } from '../utils/labels';

const failure = (error: unknown) =>
  error instanceof HttpError ? error.message : 'ذخیره نشد. اینترنتت رو چک کن و دوباره امتحان کن.';

const DEVICE_HINTS: Record<PushDeviceState, string> = {
  checking: 'در حال بررسی…',
  unavailable: 'این مرورگر از اعلان پشتیبانی نمی‌کنه. روی آیفون، اول برنامه رو به صفحه‌ی اصلی اضافه کن.',
  denied: 'توی تنظیمات مرورگر بسته شده؛ از همون‌جا بازش کن.',
  off: 'حتی وقتی برنامه بسته است هم خبردار می‌شی.',
  on: 'روشنه — روی همین گوشی اعلان می‌گیری.',
};

/**
 * `/profile/settings/notifications` — what arrives, and where. One switch
 * per category (system notices cannot be turned off and are not listed),
 * and this device's «اعلان گوشی», which asks the browser for permission
 * only when it is turned on. With the device on, each category can stay in
 * the app only. Every switch saves as it is flipped.
 */
export function NotificationSettingsScreen({ preferences }: { preferences: NotificationPreferences | null }) {
  if (!preferences) return <SettingsUnavailable />;
  return <SettingsForm preferences={preferences} />;
}

/** The read failed: say so, and offer to read again rather than show switches that would not save. */
function SettingsUnavailable() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile/settings" label="تنظیمات" iconOnly />
      </ScreenHeader>
      <ScreenBody className="gap-6">
        <ScreenTitle title="تنظیمات اعلان‌ها" />
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>تنظیمات اعلان‌ها باز نشد</AlertTitle>
          <AlertDescription>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => router.refresh()}>
              دوباره امتحان کن
            </Button>
          </AlertDescription>
        </Alert>
      </ScreenBody>
    </Screen>
  );
}

function SettingsForm({ preferences }: { preferences: NotificationPreferences }) {
  const { categories, update } = usePreferences(preferences.categories);
  const device = usePushDevice(preferences.push.available ? preferences.push.publicKey : null);

  const save = (category: (typeof categories)[number]['category'], patch: { inApp?: boolean; push?: boolean }) =>
    update(category, patch).catch((error) => toast.error(failure(error)));

  const toggleDevice = async (on: boolean) => {
    try {
      await (on ? device.enable() : device.disable());
    } catch (error) {
      toast.error(failure(error));
    }
  };

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile/settings" label="تنظیمات" iconOnly />
      </ScreenHeader>

      <ScreenBody className="gap-8">
        <ScreenTitle title="تنظیمات اعلان‌ها" description="انتخاب کن از چی و کجا باخبر بشی." />

        <ListGroup title="اعلان گوشی">
          <ListRow>
            <Smartphone aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            <SettingSwitch
              label="اعلان روی این گوشی"
              hint={DEVICE_HINTS[device.state]}
              checked={device.state === 'on'}
              disabled={device.pending || device.state === 'checking' || device.state === 'unavailable' || device.state === 'denied'}
              onChange={(on) => void toggleDevice(on)}
            />
          </ListRow>
        </ListGroup>

        <ListGroup title="چه اعلان‌هایی بگیری">
          {categories.map((row) => {
            const Icon = CATEGORY_ICONS[row.category];
            return (
              <ListRow key={row.category}>
                <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                <SettingSwitch
                  label={NOTIFICATION_CATEGORY_LABELS[row.category]}
                  hint={PREFERENCE_HINTS[row.category]}
                  checked={row.inApp}
                  onChange={(inApp) => void save(row.category, { inApp })}
                />
              </ListRow>
            );
          })}
        </ListGroup>

        {device.state === 'on' && (
          <ListGroup title="کدوم‌ها روی گوشی هم بیاد">
            {categories
              .filter((row) => row.inApp)
              .map((row) => {
                const Icon = CATEGORY_ICONS[row.category];
                return (
                  <ListRow key={row.category}>
                    <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                    <SettingSwitch
                      label={NOTIFICATION_CATEGORY_LABELS[row.category]}
                      checked={row.push}
                      onChange={(push) => void save(row.category, { push })}
                    />
                  </ListRow>
                );
              })}
          </ListGroup>
        )}

        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          اطلاعیه‌های مهم حساب همیشه میان. XPهایی که با کار خودت می‌گیری فقط توی برنامه نشون داده می‌شن.
        </p>
      </ScreenBody>
    </Screen>
  );
}
