"use client";

import {
  ClipboardList,
  GraduationCap,
  Home,
  Library,
  School,
  Settings,
  Sparkles,
  SquareCheckBig,
  X,
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { label: "Home", icon: Home },
  { label: "My Classroom", icon: GraduationCap },
  { label: "Assignments", icon: ClipboardList },
  { label: "Exams", icon: SquareCheckBig },
  { label: "My Library", icon: Library },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-sm font-bold text-white">
              V
            </span>
            <span className="text-lg font-bold tracking-tight text-neutral-900">VedaAI</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-neutral-400 hover:text-neutral-600 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <button
          type="button"
          className="mx-5 mt-1 flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
        >
          <Sparkles size={14} className="text-orange-300" />
          AI Teacher&apos;s Toolkit
        </button>

        <nav className="mt-6 flex flex-1 flex-col gap-1 px-3">
          {navItems.map(({ label, icon: Icon }) => {
            const isActive = label === "Exams";
            return (
              <button
                key={label}
                type="button"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.25 : 2} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-neutral-100 px-3 pb-5 pt-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800"
          >
            <Settings size={17} />
            Settings
          </button>

          <div className="mt-3 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-600 ring-1 ring-neutral-200">
              <School size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-neutral-800">Delhi Public School</p>
              <p className="truncate text-[11px] text-neutral-400">Bokaro Steel City</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
