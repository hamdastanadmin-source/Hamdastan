import { ToggleGroupItem } from '@hamdastan/ui';

/**
 * One interest, as a pill that toggles.
 *
 * A stock `ToggleGroupItem`, so the pressed state, `aria-pressed` and the
 * arrow-key movement are Radix's rather than ours. The styling is the only
 * adaptation: a 40px pill, outlined when off and filled with the brand
 * colour when on — a fill, not just a tint, so it reads without hue. The
 * press is a 0.97 scale over 150ms, the same feedback `Button` gives.
 */
export function InterestChip({ value, label }: { value: string; label: string }) {
  return (
    <ToggleGroupItem
      value={value}
      className="h-10 rounded-full border border-border bg-card px-4 text-sm font-normal text-foreground transition-[color,background-color,border-color,transform] duration-150 hover:bg-accent hover:text-accent-foreground active:scale-[0.97] data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {label}
    </ToggleGroupItem>
  );
}
