import * as React from "react"

import { cn } from "@hamdastan/shared/cn"

/**
 * shadcn/ui's Input, as shadcn ships it — a single `<input>`, no wrapper.
 *
 * It replaced a local version that wrapped the field in a `<div>` and took a
 * `state="error" | "success"` prop. Two things were wrong with that. The
 * wrapper broke every layout that expected an input to *be* the element it
 * was given, and the bespoke prop meant the field never reacted to
 * `aria-invalid` — which is precisely what shadcn's `Form` sets on an invalid
 * field. A form could therefore show its error message under a control that
 * still looked untouched.
 *
 * The `aria-invalid:` classes below are what close that: `Form` sets the
 * attribute, the field turns red, and neither side has to be told twice.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
      // shadcn ships `md:text-sm` here, which shrinks the text once the
      // *viewport* passes 768px. This product has no such moment: the column
      // is 430px wide on a phone and on a 27-inch monitor, so a field would
      // change size while nothing around it did. 16px throughout — which is
      // also the size that stops iOS Safari zooming in on focus.
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
