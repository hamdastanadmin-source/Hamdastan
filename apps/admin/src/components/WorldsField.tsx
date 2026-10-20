'use client';

import { WORLD_STATUS_LABELS } from '@hamdastan/config';
import type { AdminWorld } from '@hamdastan/types';
import { Checkbox, Label } from '@hamdastan/ui';

import { NEUTRAL_CHECKBOX } from './EditorField';

/**
 * Which worlds something is filed under — a checkbox per world. An archived
 * world is offered only if it is already chosen; one not published says so.
 * Shared by every editor that files content under worlds.
 */
export function WorldsField({
  worlds,
  value,
  onChange,
  disabled,
}: {
  worlds: AdminWorld[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const shown = worlds.filter((world) => world.status !== 'archived' || value.includes(world.id));

  if (shown.length === 0) return <p className="text-sm text-muted-foreground">هنوز دنیایی تعریف نشده.</p>;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((world) => {
        const checked = value.includes(world.id);
        return (
          <li key={world.id}>
            <Label className="flex items-center gap-3 rounded-lg border p-3 font-normal">
              <Checkbox
                checked={checked}
                disabled={disabled}
                className={NEUTRAL_CHECKBOX}
                onCheckedChange={(next) => onChange(next ? [...value, world.id] : value.filter((id) => id !== world.id))}
              />
              {world.name}
              {world.status !== 'published' && <span className="text-xs text-muted-foreground">({WORLD_STATUS_LABELS[world.status]})</span>}
            </Label>
          </li>
        );
      })}
    </ul>
  );
}
