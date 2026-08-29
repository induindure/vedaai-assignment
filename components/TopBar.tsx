"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bell, ChevronDown, HelpCircle, Home, Menu, Sparkles, SquareCheckBig } from "lucide-react";
import { useAppShell } from "@/lib/app-shell-context";

interface TopBarProps {
  /** Wires the back arrow to real navigation. Omit to hide it entirely (e.g. the Home page). */
  onBack?: () => void;
}

function IconButton({ children, ariaLabel }: { children: ReactNode; ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
    >
      {children}
    </button>
  );
}

export default function TopBar({ onBack }: TopBarProps) {
  // The sidebar itself now lives once in the root layout (see AppShell) rather than being
  // re-created on every page, so opening its mobile drawer goes through shared context
  // instead of a per-page prop.
  const { openSidebar } = useAppShell();

  // This label used to be hardcoded to "Exams" back when the app only had one screen —
  // now that "/" is its own Home dashboard, it needs to reflect whichever page is current.
  const pathname = usePathname();
  const isHome = pathname === "/";
  const TitleIcon = isHome ? Home : SquareCheckBig;
  const title = isHome ? "Home" : "Exams";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={openSidebar}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 lg:hidden"
        >
          <Menu size={19} />
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 sm:flex"
          >
            <ArrowLeft size={17} />
          </button>
        )}

        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <TitleIcon size={16} className="text-neutral-400" />
          {title}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <IconButton ariaLabel="Help">
          <HelpCircle size={18} />
        </IconButton>

        <div className="relative">
          <IconButton ariaLabel="Notifications">
            <Bell size={18} />
          </IconButton>
          <span className="pointer-events-none absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </div>

        <IconButton ariaLabel="AI assistant">
          <Sparkles size={18} />
        </IconButton>

        <button
          type="button"
          className="ml-1 flex items-center gap-2 rounded-full border border-neutral-200 py-1 pl-1 pr-2 transition-colors hover:bg-neutral-50 sm:pr-3"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
            MR
          </span>
          <span className="hidden text-sm font-medium text-neutral-800 sm:inline">Madhur Rastogi</span>
          <ChevronDown size={15} className="hidden text-neutral-400 sm:inline" />
        </button>
      </div>
    </header>
  );
}
