'use client';

import { useState } from 'react';
import { Bell, CircleHelp, Moon, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import type { AccountSettings } from '@hamdastan/config';
import { setTheme, useTheme } from '@hamdastan/ui/tokens/theme.store';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

import { accountErrorMessage, useAccountActions } from '../hooks/use-account-actions';
import { ListGroup, ListRow } from './ListGroup';
import { LogoutButton } from './LogoutButton';
import { SettingSwitch } from './SettingSwitch';

/**
 * «تنظیمات» — kept to what the product has: the theme,
 * notifications (a screen of their own), privacy, help, and signing out,
 * set apart at the bottom.
 *
 * An account switch saves as it is flipped and flips back if the save fails.
 * The theme switch is per device: it goes through the theme store, not the
 * account. A switch's "on" is the stock primary — a black track vanishes on
 * the dark surfaces.
 */

export function SettingsScreen({ settings: saved }: { settings: AccountSettings }) {
  const { saveSettings } = useAccountActions();
  const theme = useTheme();
  const [settings, setSettings] = useState(saved);

  const update = async (patch: Partial<AccountSettings>) => {
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await saveSettings(next);
    } catch (error) {
      setSettings(previous);
      toast.error(accountErrorMessage(error));
    }
  };

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile" />
      </ScreenHeader>

      <ScreenBody className="gap-8">
        <ScreenTitle title="تنظیمات" />

        <ListGroup title="ظاهر">
          <ListRow>
            <Moon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            <SettingSwitch
              label="حالت تاریک"
              checked={theme === 'dark'}
              onChange={(dark) => setTheme(dark ? 'dark' : 'light')}
            />
          </ListRow>
        </ListGroup>

        <ListGroup title="اعلان‌ها">
          <ListRow icon={Bell} label="اعلان‌ها و اعلان گوشی" href="/profile/settings/notifications" />
        </ListGroup>

        <ListGroup title="حریم خصوصی">
          <ListRow>
            <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            <SettingSwitch
              label="نمایش پروفایل اجتماعی به دیگران"
              hint="فقط خلاصه‌ی نتیجه، بدون جزئیات."
              checked={settings.showSocialProfile}
              onChange={(showSocialProfile) => void update({ showSocialProfile })}
            />
          </ListRow>
        </ListGroup>

        <ListGroup title="پشتیبانی">
          <ListRow icon={CircleHelp} label="راهنما و پشتیبانی" href="/profile/help" />
        </ListGroup>

        <div className="mt-auto border-t border-border pt-4">
          <LogoutButton />
        </div>
      </ScreenBody>
    </Screen>
  );
}
