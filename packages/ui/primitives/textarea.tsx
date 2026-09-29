import * as React from "react"
import { cn } from "@hamdastan/shared/cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
      // shadcn ships `md:text-sm` here, which shrinks the text once the
      // *viewport* passes 768px. This product has no such moment: the column
      // is 430px wide on a phone and on a 27-inch monitor, so a field would
      // change size while nothing around it did. 16px throughout — which is
      // also the size that stops iOS Safari zooming in on focus.
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
