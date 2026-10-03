'use client';

import { useId, useState } from 'react';
import { Bell, CircleHelp, ShieldCheck, UserRoundPen } from 'lucide-react';
import { toast } from 'sonner';

import type { AccountSettings } from '@hamdastan/config';
import { Switch } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

import { accountErrorMessage, useAccountActions } from '../hooks/use-account-actions';
import { ListGroup, ListRow } from './ListGroup';
import { LogoutButton } from './LogoutButton';

/**
 * «تنظیمات» — kept to what the product has: the profile, notifications,
 * privacy, help, and signing out, set apart at the bottom.
 *
 * A switch saves as it is flipped and flips back if the save fails. Its "on"
 * is foreground on a light track — the brand stays on primary actions.
 */

const SWITCH_CLASS =
  'data-[state=checked]:bg-foreground [&>[data-slot=switch-thumb][data-state=checked]]:bg-background';

function SettingSwitch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    // The whole row is the label, so the target is the row and not the 32px switch.
    <label htmlFor={id} className="flex w-full cursor-pointer items-center gap-3">
      <span className="flex flex-1 flex-col gap-0.5">
        <span>{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className={SWITCH_CLASS} />
    </label>
  );
}

export function SettingsScreen({ settings: saved }: { settings: AccountSettings }) {
  const { saveSettings } = useAccountActions();
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

        <ListGroup title="حساب">
          <ListRow icon={UserRoundPen} label="ویرایش پروفایل" href="/profile/edit" />
        </ListGroup>

        <ListGroup title="اعلان‌ها">
          <ListRow>
            <Bell aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            <SettingSwitch
              label="ماموریت‌ها و پیشرفت"
              checked={settings.notifications}
              onChange={(notifications) => void update({ notifications })}
            />
          </ListRow>
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
