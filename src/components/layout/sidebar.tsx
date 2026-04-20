"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  BookOpen,
  Clock,
  Users,
  Star,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotebooks } from "@/hooks/use-notebooks";
import { FluxLogo } from "@/components/shared/flux-logo";

const navItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard", color: "#ff6b35", view: undefined as string | undefined },
  { href: "/dashboard?view=all", icon: BookOpen, label: "All Notebooks", color: "#7c3aed", view: "all" },
  { href: "/dashboard?view=recent", icon: Clock, label: "Recent", color: "#2563eb", view: "recent" },
  { href: "/dashboard?view=shared", icon: Users, label: "Shared with Me", color: "#22c55e", view: "shared" },
  { href: "/dashboard?view=starred", icon: Star, label: "Starred", color: "#f59e0b", view: "starred" },
] as const;

const DOT_COLORS = ["#ff6b35", "#e11d48", "#7c3aed", "#2563eb", "#22c55e"];

const SidebarInner = ({
  collapsed,
}: {
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}): React.ReactNode => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");
  const { data: notebooks } = useNotebooks();

  const recentNotebooks = notebooks?.slice(0, 3) ?? [];

  return (
    <aside
      className="hidden md:flex flex-col h-screen fixed left-0 top-0 z-30 fm-themed"
      style={{
        width: collapsed ? 60 : 240,
        background: "var(--fm-sidebar-bg)",
        borderRight: "1px solid var(--fm-sidebar-border)",
        transition:
          "width 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 0.4s ease, border-color 0.4s ease",
      }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <FluxLogo size={36} className="shrink-0" />
          {!collapsed && (
            <span
              className="font-bold text-base whitespace-nowrap fm-sidebar-label"
              style={{ color: "var(--fm-text)" }}
            >
              FluxMind
            </span>
          )}
        </Link>
      </div>

      {/* New Notebook button */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <button
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white"
            style={{
              background: "var(--fm-accent-gradient)",
              borderRadius: 12,
              padding: "10px 0",
            }}
            onClick={() => {
              window.dispatchEvent(new CustomEvent("fluxmind:create-notebook"));
            }}
          >
            <Plus className="h-4 w-4" />
            New Notebook
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-1 px-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === "/dashboard" && (
            item.view === undefined ? !currentView : currentView === item.view
          );
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "fm-sidebar-item flex items-center gap-3 px-2.5 py-2.5 text-sm transition-colors relative",
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
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r"
                  style={{ background: "linear-gradient(135deg, #ff6b35, #e11d48, #7c3aed)" }}
                />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <span className="whitespace-nowrap fm-sidebar-label">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Recent Notebooks */}
      {!collapsed && recentNotebooks.length > 0 && (
        <div className="px-3 pb-4">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
            Recent Notebooks
          </p>
          <div className="space-y-1">
            {recentNotebooks.map((nb, i) => {
              const isNbActive = pathname === `/notebook/${nb.id}`;
              return (
              <Link
                key={nb.id}
                href={`/notebook/${nb.id}`}
                className="fm-sidebar-item flex items-center gap-2 px-2 py-1.5 text-xs transition-colors rounded-md"
                style={{
                  color: isNbActive ? "var(--fm-text)" : "var(--fm-text-secondary)",
                  background: isNbActive ? "var(--fm-surface-hover)" : undefined,
                  fontWeight: isNbActive ? 500 : 400,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                />
                <span className="truncate">{nb.title}</span>
              </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="mt-auto px-2 pb-3">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-2.5 py-2 text-sm transition-colors"
          style={{
            borderRadius: 10,
            color: "var(--fm-text-tertiary)",
          }}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && (
            <span className="whitespace-nowrap fm-sidebar-label">
              Settings
            </span>
          )}
        </Link>
      </div>
    </aside>
  );
};

export const Sidebar = (props: {
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}): React.ReactNode => {
  return (
    <Suspense fallback={<div />}>
      <SidebarInner {...props} />
    </Suspense>
  );
};
