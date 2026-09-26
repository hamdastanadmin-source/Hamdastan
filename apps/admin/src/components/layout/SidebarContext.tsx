'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Whether the sidebar is collapsed, and whether the mobile drawer is open.
 *
 * Two separate pieces of state because they belong to two different layouts:
 * on a desktop the sidebar narrows to icons, and on a phone it is a drawer that
 * is either there or not.
 *
 * Neither is persisted. Both survive navigation inside the panel, because the
 * provider sits in the layout and React keeps it mounted; only a full reload
 * starts expanded again. Remembering the choice in `localStorage` would mean
 * the server renders one width and the browser hydrates another, and a
 * flickering sidebar costs more than re-collapsing it does.
 */

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((previous) => !previous);
  }, []);

  return (
    <SidebarContext.Provider
      value={{ isCollapsed, toggleCollapse, isMobileOpen, setMobileOpen }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within SidebarProvider');
  return context;
}
