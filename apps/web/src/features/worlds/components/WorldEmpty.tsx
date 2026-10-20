import Link from 'next/link';

/** A list with nothing in it, or one that could not be read — said plainly, with a way to try again. */
export function WorldEmpty({ children, retryHref }: { children: React.ReactNode; retryHref?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      <p>{children}</p>
      {retryHref && (
        <Link href={retryHref} className="font-semibold text-foreground underline-offset-4 hover:underline">
          تلاش دوباره
        </Link>
      )}
    </div>
  );
}
