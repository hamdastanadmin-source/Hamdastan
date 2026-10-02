"use client"

import * as React from "react"
import { cn } from "@hamdastan/shared/cn"
import { Progress as ProgressPrimitive } from "radix-ui"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
      {...props}
    >
      {/* shadcn ships an inline `translateX(-n%)`, which fills the bar from
          the left — backwards in an RTL product. The offset rides in a custom
          property instead so the `rtl:` variant can push it the other way.
          rtl-ok: the bar fills from the reading start, and that edge is
          physical in a transform. */}
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all -translate-x-(--progress-gap) rtl:translate-x-(--progress-gap)"
        style={{ "--progress-gap": `${100 - (value || 0)}%` } as React.CSSProperties}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
