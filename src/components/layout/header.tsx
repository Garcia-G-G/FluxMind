"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Bell, Moon, Sun, Settings, Menu, LogOut, User } from "lucide-react";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { useSession, signOut } from "@/lib/auth-client";
import { useFluxTheme } from "@/components/shared/theme-provider";
import { LanguageToggle } from "@/components/shared/language-toggle";

export const Header = ({
  onOpenCommandPalette,
  onToggleSidebar,
}: {
  onOpenCommandPalette: () => void;
  onToggleSidebar?: () => void;
}): React.ReactNode => {
  const { data: session } = useSession();
  const { mode, toggleMode } = useFluxTheme();
  const [themeRotation, setThemeRotation] = useState(0);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Gate anything session-dependent on mount so server-rendered HTML doesn't
  // disagree with the first client render (better-auth's useSession is async).
  const initial = mounted
    ? session?.user?.name?.[0]?.toUpperCase() ?? "G"
    : "";

  // Close dropdown on outside click
  useEffect(() => {
    if (!avatarOpen) return;
    const handler = (e: MouseEvent): void => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [avatarOpen]);

  const handleThemeToggle = (): void => {
    setThemeRotation((r) => r + 360);
    toggleMode();
  };

  return (
    <header
      className="h-[60px] flex items-center justify-between px-4 sticky top-0 z-20 fm-themed"
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
          <div
            style={{
              transform: `rotate(${themeRotation}deg)`,
              transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {mode === "dark" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </div>
        </button>

        <LanguageToggle />

        <Link
          href="/settings"
          className="h-9 w-9 flex items-center justify-center rounded-lg fm-sidebar-item"
          style={{ color: "var(--fm-text-secondary)" }}
          aria-label="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </Link>

        <div ref={avatarRef} className="relative ml-1">
          <button
            onClick={() => setAvatarOpen((p) => !p)}
            className="h-9 w-9 rounded-full p-[2px] shrink-0 cursor-pointer"
            style={{ background: "linear-gradient(135deg, var(--fm-accent-rose), var(--fm-accent-violet))" }}
            aria-label="Account menu"
          >
            <div
              className="h-full w-full rounded-full flex items-center justify-center text-sm font-semibold"
              style={{ background: "var(--fm-surface)", color: "var(--fm-text)" }}
            >
              {initial}
            </div>
          </button>

          {avatarOpen && (
            <div
              className="absolute right-0 top-11 w-48 rounded-lg py-1 shadow-lg fm-fade-in"
              style={{
                background: "var(--fm-surface)",
                border: "1px solid var(--fm-surface-border)",
                zIndex: 50,
              }}
            >
              <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--fm-surface-border)" }}>
                <p className="text-xs font-medium truncate" style={{ color: "var(--fm-text)" }}>
                  {session?.user?.name ?? "User"}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--fm-text-tertiary)" }}>
                  {session?.user?.email ?? ""}
                </p>
              </div>
              <Link
                href="/settings"
                onClick={() => setAvatarOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                style={{ color: "var(--fm-text-secondary)" }}
              >
                <User className="h-3.5 w-3.5" />
                Settings
              </Link>
              <button
                onClick={() => { setAvatarOpen(false); signOut(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left"
                style={{ color: "var(--fm-error, #ef4444)" }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
