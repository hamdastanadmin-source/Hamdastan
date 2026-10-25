import { cn } from '@hamdastan/shared/cn';

/**
 * The neutral figure — a head and shoulders in muted grey — shown wherever
 * the person has no role character yet: before the questionnaire, after
 * skipping it, or without a gender on file. Never a made-up avatar.
 *
 * Decorative: the caller's box carries the background and any label.
 */
export function PersonSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={cn('block fill-current text-muted-foreground/45', className)}
    >
      <ellipse cx="50" cy="31" rx="15.5" ry="17" />
      <path d="M18 76 C18 62 32 53 50 53 C68 53 82 62 82 76 C82 82 78 86 72 86 H28 C22 86 18 82 18 76 Z" />
    </svg>
  );
}
