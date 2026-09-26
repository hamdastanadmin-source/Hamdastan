'use client';

import type { ReactNode } from 'react';
import type { AdminPrincipal } from '@hamdastan/types';

import { AdminProvider } from '@/features/auth';

import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { SidebarProvider } from './SidebarContext';

/**
 * The frame every signed-in page renders inside: sidebar, header, content.
 *
 * The admin is resolved on the server by the dashboard layout and handed down
 * through `AdminProvider`, so no component inside fetches the session for
 * itself and every one of them sees the same answer.
 *
 *   ┌───────────────┬─────────────────────────┐
 *   │               │ Header                  │
 *   │ Sidebar       ├─────────────────────────┤
 *   │               │ Main content            │
 *   └───────────────┴─────────────────────────┘
 */
export function AdminShell({
  admin,
  children,
}: {
  admin: AdminPrincipal;
  children: ReactNode;
}) {
  return (
    <AdminProvider admin={admin}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AdminSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <AdminHeader />
            <main id="main-content" className="flex-1 p-4 sm:p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminProvider>
  );
}
