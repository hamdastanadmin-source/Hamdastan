"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { colors } from "../tokens/colors"
import { useTheme } from "../tokens/theme.store"
import { APP_DIR } from "@hamdastan/config"

const Toaster = ({ style, ...props }: ToasterProps) => {
  const theme = useTheme()

  return (
    <Sonner
      theme={theme}
      dir={APP_DIR}
      className="toaster group"
      // Success and error carry their own soft tint (`--*-soft` in
      // tokens.css); everything else stays on the neutral popover.
      richColors
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      // Sonner's 13px is a Latin size; Persian needs the body's 14px to be
      // read rather than glanced at.
      toastOptions={{ className: "!text-sm !leading-relaxed" }}
      style={
        {
          // Sonner sets a system font stack of its own; the app's is on body.
          fontFamily: "inherit",
          "--normal-bg": colors.popover,
          "--normal-text": colors.popoverForeground,
          "--normal-border": colors.border,
          "--success-bg": colors.successSoft,
          "--success-text": colors.successSoftForeground,
          "--success-border": colors.successSoftBorder,
          "--error-bg": colors.destructiveSoft,
          "--error-text": colors.destructiveSoftForeground,
          "--error-border": colors.destructiveSoftBorder,
          "--border-radius": "var(--radius)",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
