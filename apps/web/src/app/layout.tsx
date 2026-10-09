import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { APP_DIR, APP_NAME, APP_LANG } from "@hamdastan/config";
import { DirectionProvider, Toaster } from "@hamdastan/ui";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "@hamdastan/ui/tokens";

import { MobileShell } from "@/components";
import { AuthProvider } from "@/features/auth";
import { getSession } from "@/features/auth/server";

import "@/styles/globals.css";

/** The toast's gap to the column's edge — the page gutter. */
const TOAST_GUTTER = "1rem";
const TOAST_MOBILE_INSET = `max(${TOAST_GUTTER}, calc((100vw - var(--shell-max-width)) / 2 + ${TOAST_GUTTER}))`;

const yekanBakh = localFont({
  src: "../../public/fonts/YekanBakh-VF.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-yekan-bakh",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "دنیاهای داستانی‌ات منتظرتن — بازی کن، امتیاز بگیر و با بقیه‌ی طرفدارها رقابت کن.",
  manifest: "/manifest.webmanifest",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    // The app is dark; a translucent bar would show the page behind it.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

/**
 * `viewportFit: "cover"` is what lets the layout reach under the notch and
 * the home indicator; the `env(safe-area-inset-*)` padding in `Screen` is
 * what keeps content out from under them. `userScalable` is left alone —
 * disabling zoom is an accessibility failure, not a polish step.
 */
export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html
      lang={APP_LANG}
      dir={APP_DIR}
      className={yekanBakh.variable}
      data-theme="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${yekanBakh.className} font-sans antialiased bg-surface-0 text-foreground`}
      >
        {/* Radix portals its overlays out of the RTL subtree; this carries
            the direction across for them. */}
        <DirectionProvider dir={APP_DIR}>
          <AuthProvider user={session?.user ?? null}>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
            >
              رفتن به محتوای اصلی
            </a>
            <MobileShell>{children}</MobileShell>
          </AuthProvider>
          {/* Constrained to the column so a toast does not span a laptop:
              as wide as the column less its gutters, and — below Sonner's
              600px mobile breakpoint, where it spans the viewport instead —
              inset by the column's margin plus the same gutter. */}
          <Toaster
            position="top-center"
            style={{ "--width": `calc(var(--shell-max-width) - ${TOAST_GUTTER} * 2)` } as CSSProperties}
            mobileOffset={{
              left: TOAST_MOBILE_INSET,
              right: TOAST_MOBILE_INSET,
            }}
          />
        </DirectionProvider>
      </body>
    </html>
  );
}
