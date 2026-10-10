import type { Metadata } from "next";
import localFont from "next/font/local";

import { APP_DIR, APP_LANG, APP_NAME } from "@hamdastan/config";
import { DirectionProvider, Toaster } from "@hamdastan/ui";
import { THEME_INIT_SCRIPT } from "@hamdastan/ui/tokens";

import "@/styles/globals.css";

const yekanBakh = localFont({
  src: "../../public/fonts/YekanBakh-VF.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-yekan-bakh",
});

export const metadata: Metadata = {
  title: { default: `پنل مدیریت ${APP_NAME}`, template: `%s · پنل مدیریت ${APP_NAME}` },
  description: `پنل مدیریت ${APP_NAME}`,
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
        className={`${yekanBakh.className} font-sans antialiased bg-background text-foreground`}
      >
        {/* Radix writes `dir` on its own roots (ToggleGroup, Tabs, …) and on
            portalled overlays; without the provider they default to LTR. */}
        <DirectionProvider dir={APP_DIR}>
          {children}
          <Toaster />
        </DirectionProvider>
      </body>
    </html>
  );
}
