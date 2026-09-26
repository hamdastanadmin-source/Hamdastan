import type { Metadata } from "next";
import localFont from "next/font/local";

import { APP_DIR, APP_LANG, APP_NAME } from "@hamdastan/config";
import { Toaster } from "@hamdastan/ui";
import { THEME_INIT_SCRIPT } from "@hamdastan/ui/tokens";

import "@/styles/globals.css";

const yekanBakh = localFont({
  src: "../../public/fonts/YekanBakh-VF.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-yekan-bakh",
});

export const metadata: Metadata = {
  title: `پنل مدیریت ${APP_NAME}`,
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
      className={`dark ${yekanBakh.variable}`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${yekanBakh.className} font-sans antialiased bg-background text-foreground`}
      >
        {/* No landmark here: the page provides it — `AdminShell` for the
            dashboard, the sign-in screens for themselves. Two nested <main>
            elements with one id is invalid and confuses a screen reader. */}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
