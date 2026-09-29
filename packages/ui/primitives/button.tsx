import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@hamdastan/shared/cn"
import { Slot } from "radix-ui"
import { Spinner } from "./spinner"

/**
 * What a disabled *filled* button looks like.
 *
 * The base `disabled:opacity-50` fades the fill and the label together, which
 * on a saturated button reads as "enabled, but something is wrong with the
 * text" rather than "not yet". A filled button drops to the muted surface
 * instead, where the label stays legible and the control is visibly inert.
 * Ghost and link keep the fade — there is no fill to replace.
 */
const disabledFill =
  "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground hover:bg-primary/90 ${disabledFill}`,
        destructive: `bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 ${disabledFill}`,
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Explicit brand fill. `default` already uses the brand hue via
        // --primary; this variant pins the deeper brand-500 step instead.
        brand: `bg-brand-500 text-white border border-brand-400/30 shadow-sm hover:bg-brand-600 focus-visible:bg-brand-600 disabled:border-transparent ${disabledFill}`,
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        // The bottom-of-screen action on a phone: 48px tall, comfortably
        // past the 44px touch minimum. The weight is part of the size, not a
        // per-screen decision — this is the one thing the screen is asking
        // for, so every caller was writing `font-bold` by hand.
        xl: "h-12 rounded-lg px-8 text-base font-bold has-[>svg]:px-6",
        // A control in a screen header — back, sign out. `sm` is 32px, which
        // misses the 44px touch minimum, and a header action is often the
        // only way off a screen.
        touch: "h-11 gap-1.5 rounded-md px-3",
        // The same minimum for an icon-only control. `icon` is 36px and
        // `icon-lg` 40px; neither is a target a thumb reliably hits.
        "icon-touch": "size-11",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows an inline spinner and blocks interaction while truthy. */
    loading?: boolean
  }) {
  const classes = cn(buttonVariants({ variant, size, className }))

  // `asChild` renders an arbitrary child, so the spinner/disabled handling
  // below does not apply — pass through untouched.
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={classes}
        {...props}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export { Button, buttonVariants }
