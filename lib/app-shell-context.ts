"use client";

import { createContext, useContext } from "react";

export interface AppShellContextValue {
  /** Opens the mobile sidebar drawer — the Sidebar itself lives once in the root layout. */
  openSidebar: () => void;
  /**
   * Bumped every time "Home" or "Exams" is clicked in the sidebar. The /exams page uses this
   * as a React `key` on its upload/results flow, so clicking "Exams" while already on that
   * page — which doesn't itself trigger a route change, since the URL doesn't change — still
   * starts the flow over, the same way navigating there fresh would.
   */
  resetSignal: number;
}

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within the app's root layout (AppShell).");
  }
  return ctx;
}
