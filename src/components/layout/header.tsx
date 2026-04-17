"use client";

import { Search, Bell } from "lucide-react";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { useSession } from "@/lib/auth-client";

export const Header = ({
  onOpenCommandPalette,
}: {
  onOpenCommandPalette: () => void;
}): React.ReactNode => {
  const { data: session } = useSession();
  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "FM";

  return (
    <header
      className="h-[60px] flex items-center justify-between px-4 sticky top-0 z-20"
      style={{
        background: "var(--fm-header-bg)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--fm-header-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <MobileSidebar />
      </div>

      {/* Center: search */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden sm:flex items-center gap-2 px-3 h-9 max-w-[400px] text-xs transition-all"
        style={{
          background: "var(--fm-input-bg)",
          border: "1px solid var(--fm-input-border)",
          borderRadius: 10,
          color: "var(--fm-text-tertiary)",
        }}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd
          className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded px-1.5 font-mono text-[10px] font-medium"
          style={{ background: "var(--fm-surface)", color: "var(--fm-text-tertiary)", border: "1px solid var(--fm-surface-border)" }}
        >
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button
          className="sm:hidden h-9 w-9 flex items-center justify-center rounded-lg transition-colors"
          onClick={onOpenCommandPalette}
          style={{ color: "var(--fm-text-secondary)" }}
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          className="relative h-9 w-9 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: "var(--fm-text-secondary)" }}
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* User avatar with gradient border */}
        <div
          className="h-9 w-9 rounded-full p-[2px] shrink-0"
          style={{ background: "var(--fm-accent-gradient)" }}
        >
          <div
            className="h-full w-full rounded-full flex items-center justify-center text-xs font-medium"
            style={{ background: "var(--fm-surface)", color: "var(--fm-text)" }}
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
};
