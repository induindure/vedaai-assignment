"use client";

import type { ReactNode } from "react";
import { ArrowLeft, Bell, ChevronDown, HelpCircle, Menu, Sparkles, SquareCheckBig } from "lucide-react";

interface TopBarProps {
  onMenuClick: () => void;
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

export default function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 lg:hidden"
        >
          <Menu size={19} />
        </button>

        <button
          type="button"
          aria-label="Go back"
          className="hidden h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 sm:flex"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <SquareCheckBig size={16} className="text-neutral-400" />
          Exams
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
