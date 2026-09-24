import type { Metadata } from "next";
import localFont from "next/font/local";

import { APP_DIR, APP_LANG, APP_NAME } from "@hamdastan/config";
import { Toaster } from "@hamdastan/ui";
import { THEME_INIT_SCRIPT } from "@hamdastan/ui/tokens";

import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { AuthProvider } from "@/features/auth";
import { getSession } from "@/features/auth/server";

import "@/styles/globals.css";

const yekanBakh = localFont({
  src: "../../public/fonts/YekanBakh-VF.woff2",
  display: "swap",
  weight: "100 900",
  variable: "--font-yekan-bakh",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_NAME,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSession();

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
        <AuthProvider user={user}>
          {user ? (
            <>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
              >
                رفتن به محتوای اصلی
              </a>
              <SidebarProvider>
                <div className="flex min-h-screen">
                  <Sidebar />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <Header />
                    <main id="main-content" className="flex-1">
                      {children}
                    </main>
                  </div>
                </div>
              </SidebarProvider>
            </>
          ) : (
            // Signed out: render bare, without the app shell (login page).
            children
          )}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
