"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Settings,
  CreditCard,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Sun,
  Moon,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { useSession } from "@/lib/auth-client";
import { useFluxTheme } from "@/components/shared/theme-provider";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard", icon: BookOpen, label: "All Notebooks" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/settings/billing", icon: CreditCard, label: "Billing" },
] as const;

export const Sidebar = ({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}): React.ReactNode => {
  const pathname = usePathname();
  const { mode, toggleMode } = useFluxTheme();
  const { data: session } = useSession();
  const [themeRotation, setThemeRotation] = React.useState(0);

  const handleThemeToggle = (): void => {
    setThemeRotation((r) => r + 360);
    toggleMode();
  };

  return (
    <aside
      className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-30"
      style={{
        width: collapsed ? 60 : 240,
        background: "var(--fm-sidebar-bg)",
        borderRight: "1px solid var(--fm-sidebar-border)",
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3" style={{ borderBottom: "1px solid var(--fm-sidebar-border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--fm-accent-gradient)" }}
          >
            <span className="text-white font-bold text-sm">F</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-sm whitespace-nowrap"
              style={{ color: "var(--fm-text)" }}
            >
              <span
                style={{
                  background: "var(--fm-accent-gradient-text)",
                  backgroundSize: "200% auto",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Flux
              </span>
              Mind
            </motion.span>
          )}
        </Link>
      </div>

      {/* New Notebook button */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <Link href="/dashboard">
            <button
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--fm-accent-gradient)", borderRadius: 12, padding: "10px 0" }}
            >
              <Plus className="h-4 w-4" />
              New Notebook
            </button>
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2 text-sm transition-colors relative",
              )}
              style={{
                borderRadius: 10,
                color: isActive ? "var(--fm-text)" : "var(--fm-text-secondary)",
                background: isActive ? "var(--fm-surface-hover)" : undefined,
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r"
                  style={{ background: "var(--fm-accent-violet)" }}
                />
              )}
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-nowrap">
                  {item.label}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 space-y-1" style={{ borderTop: "1px solid var(--fm-sidebar-border)" }}>
        <button
          onClick={handleThemeToggle}
          aria-label="Toggle theme"
          className="flex items-center gap-3 px-2.5 py-2 text-sm w-full transition-colors"
          style={{ borderRadius: 10, color: "var(--fm-text-secondary)" }}
        >
          <motion.div animate={{ rotate: themeRotation }} transition={{ duration: 0.5 }}>
            {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </motion.div>
          {!collapsed && <span className="whitespace-nowrap">Toggle theme</span>}
        </button>

        <div className="flex items-center gap-3 px-2.5 py-1.5">
          <UserMenu />
          {!collapsed && session?.user && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
              <p className="text-sm font-medium truncate leading-tight" style={{ color: "var(--fm-text)" }}>
                {session.user.name}
              </p>
              <p className="text-xs truncate leading-tight" style={{ color: "var(--fm-text-tertiary)" }}>
                Free plan
              </p>
            </motion.div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full justify-start gap-3 px-2.5"
          style={{ borderRadius: 10, color: "var(--fm-text-secondary)" }}
        >
          {collapsed ? <PanelLeft className="h-4 w-4 shrink-0" /> : (
            <><PanelLeftClose className="h-4 w-4 shrink-0" /><span>Collapse</span></>
          )}
        </Button>
      </div>
    </aside>
  );
};

// Need React for useState in this file
import React from "react";
