import { Check } from 'lucide-react';

import { ToggleGroupItem } from '@hamdastan/ui';

/**
 * One interest, as a pill that toggles.
 *
 * A stock `ToggleGroupItem`, so the pressed state, `aria-pressed` and the
 * arrow-key movement are Radix's rather than ours. The styling is the only
 * adaptation: 44px tall for a thumb, a brand tint and border when on, and a
 * check mark so "selected" is not carried by colour alone. The press is a
 * 0.97 scale over 150ms, the same feedback `Button` gives.
 */
export function InterestChip({ value, label }: { value: string; label: string }) {
  return (
    <ToggleGroupItem
      value={value}
      className="group/chip h-11 gap-1.5 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-[color,background-color,border-color,transform] duration-150 hover:bg-accent hover:text-accent-foreground active:scale-[0.97] data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-foreground motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <Check
        aria-hidden="true"
        className="hidden text-primary group-data-[state=on]/chip:block"
      />
      {label}
    </ToggleGroupItem>
  );
}
