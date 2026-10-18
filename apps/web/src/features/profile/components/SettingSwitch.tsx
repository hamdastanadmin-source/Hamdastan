'use client';

import { useId } from 'react';

import { Switch } from '@hamdastan/ui';

/**
 * A settings row's label and its switch. The whole row is the label, so the
 * target is the row and not the 32px switch.
 */
export function SettingSwitch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex w-full cursor-pointer items-center gap-3">
      <span className="flex flex-1 flex-col gap-0.5">
        <span>{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}
