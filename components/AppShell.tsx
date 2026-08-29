"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { AppShellContext } from "@/lib/app-shell-context";

/**
 * Wraps every page in the shared Sidebar plus its mobile-drawer state. Defined once here in
 * the root layout (rather than per-page, as it used to be) so it persists across navigation
 * between "/" and "/exams" — one Sidebar instance for the whole app, no remount/flicker when
 * switching routes.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  return (
    <AppShellContext.Provider value={{ openSidebar: () => setSidebarOpen(true), resetSignal }}>
      <div className="bg-neutral-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={() => setResetSignal((n) => n + 1)} />
        <div className="lg:pl-[220px]">{children}</div>
      </div>
    </AppShellContext.Provider>
  );
}
