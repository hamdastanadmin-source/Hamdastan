import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { cn } from '@hamdastan/shared/cn';

/**
 * An amount of XP, as the person reads it: «+۵۰ XP», «۱۲۰ / ۲۰۰ XP».
 *
 * Isolated as an LTR run (`dir="ltr"`): in an RTL line the Latin «XP» and the sign would
 * otherwise be reordered around the digits — «XP ۵۰+».
 */
export function XpAmount({
  value,
  of,
  signed = false,
  className,
}: {
  value: number;
  /** Shown as «value / of XP». */
  of?: number | null;
  signed?: boolean;
  className?: string;
}) {
  const amount = `${signed ? '+' : ''}${toPersianDigits(value)}`;
  const text = of ? `${amount} / ${toPersianDigits(of)} XP` : `${amount} XP`;
  return (
    <bdi dir="ltr" className={cn('tabular-nums', className)}>
      {text}
    </bdi>
  );
}
