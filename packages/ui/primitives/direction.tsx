"use client"

import * as React from "react"
import { Direction } from "radix-ui"

/**
 * Radix's direction context, wrapped so apps do not import Radix themselves.
 *
 * `dir="rtl"` on `<html>` is enough for anything rendered inside it, but
 * Radix portals its overlays to `document.body`, where that attribute is not
 * an ancestor any more. A provider near the root is what carries the
 * direction across the portal, so a `Select` opened in an RTL page keeps its
 * alignment and its arrow-key order.
 */
export function DirectionProvider({
  dir,
  children,
}: {
  dir: "ltr" | "rtl"
  children: React.ReactNode
}) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>
}
