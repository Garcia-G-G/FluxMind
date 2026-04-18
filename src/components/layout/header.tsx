"use client";

import React from "react";
import { Search, Bell, Moon, Sun, Settings, Menu } from "lucide-react";
import { motion } from "motion/react";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { useSession } from "@/lib/auth-client";
import { useFluxTheme } from "@/components/shared/theme-provider";

export const Header = ({
  onOpenCommandPalette,
  onToggleSidebar,
}: {
  onOpenCommandPalette: () => void;
  onToggleSidebar?: () => void;
}): React.ReactNode => {
  const { data: session } = useSession();
  const { mode, toggleMode } = useFluxTheme();
  const [themeRotation, setThemeRotation] = React.useState(0);

  const initial = session?.user?.name?.[0]?.toUpperCase() ?? "G";

  const handleThemeToggle = (): void => {
    setThemeRotation((r) => r + 360);
    toggleMode();
  };

  return (
    <header
      className="h-[60px] flex items-center justify-between px-4 sticky top-0 z-20"
      style={{
        background: "var(--fm-header-bg)",
        borderBottom: "1px solid var(--fm-header-border)",
      }}
    >
      {/* Left: hamburger */}
      <div className="flex items-center">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--fm-text-secondary)" }}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <MobileSidebar />
      </div>

      {/* Center: search bar */}
      <button
        onClick={onOpenCommandPalette}
        className="flex items-center gap-2 px-4 h-9 max-w-[450px] w-full text-sm mx-4"
        style={{
          background: "var(--fm-input-bg)",
          border: "1px solid var(--fm-input-border)",
          borderRadius: 10,
          color: "var(--fm-text-tertiary)",
        }}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Search notebooks, sources, conve...</span>
        <span className="sm:hidden">Search...</span>
      </button>

      {/* Right: bell, theme, settings, avatar */}
      <div className="flex items-center gap-1.5">
        <button
          className="relative h-9 w-9 flex items-center justify-center rounded-lg"
          style={{ color: "var(--fm-text-secondary)" }}
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span
            className="absolute top-1.5 right-2 h-2 w-2 rounded-full"
            style={{ background: "var(--fm-accent-orange)" }}
          />
        </button>

        <button
          onClick={handleThemeToggle}
          className="h-9 w-9 flex items-center justify-center rounded-lg"
          style={{ color: "var(--fm-text-secondary)" }}
          aria-label="Toggle theme"
        >
          <motion.div animate={{ rotate: themeRotation }} transition={{ duration: 0.5 }}>
            {mode === "dark" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </motion.div>
        </button>

        <button
          className="h-9 w-9 flex items-center justify-center rounded-lg"
          style={{ color: "var(--fm-text-secondary)" }}
          aria-label="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>

        <div
          className="h-9 w-9 rounded-full p-[2px] shrink-0 ml-1"
          style={{ background: "linear-gradient(135deg, var(--fm-accent-rose), var(--fm-accent-violet))" }}
        >
          <div
            className="h-full w-full rounded-full flex items-center justify-center text-sm font-semibold"
            style={{ background: "var(--fm-surface)", color: "var(--fm-text)" }}
          >
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
};
