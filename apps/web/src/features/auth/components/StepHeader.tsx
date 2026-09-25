/**
 * The title and one line of explanation each step opens with.
 *
 * Feature-local on purpose: `SectionHeader` in `@hamdastan/ui` renders an `h2`
 * with an icon for a page section, and a login step is a page with an `h1`.
 */
export function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
