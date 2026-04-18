"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  BookOpen,
  Clock,
  Users,
  Star,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useNotebooks } from "@/hooks/use-notebooks";

const navItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard", color: "#ff6b35" },
  { href: "/dashboard", icon: BookOpen, label: "All Notebooks", color: "#7c3aed" },
  { href: "/dashboard", icon: Clock, label: "Recent", color: "#2563eb" },
  { href: "/dashboard", icon: Users, label: "Shared with Me", color: "#22c55e" },
  { href: "/dashboard", icon: Star, label: "Starred", color: "#f59e0b" },
] as const;

const DOT_COLORS = ["#ff6b35", "#e11d48", "#7c3aed", "#2563eb", "#22c55e"];

export const Sidebar = ({
  collapsed,
}: {
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}): React.ReactNode => {
  const pathname = usePathname();
  const { data: notebooks } = useNotebooks();

  const recentNotebooks = notebooks?.slice(0, 3) ?? [];

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
      <div className="flex items-center h-14 px-3">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--fm-accent-gradient)" }}
          >
            <span className="text-white font-bold text-sm">F</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-base whitespace-nowrap"
              style={{ color: "var(--fm-text)" }}
            >
              FluxMind
            </motion.span>
          )}
        </Link>
      </div>

      {/* New Notebook button */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <button
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: "var(--fm-accent-orange)",
              borderRadius: 10,
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
        {navItems.map((item, idx) => {
          const isActive = idx === 0 && pathname === "/dashboard";
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2.5 text-sm transition-colors relative",
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
                  style={{ background: item.color }}
                />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-nowrap">
                  {item.label}
                </motion.span>
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
            {recentNotebooks.map((nb, i) => (
              <Link
                key={nb.id}
                href={`/notebook/${nb.id}`}
                className="flex items-center gap-2 px-2 py-1.5 text-xs transition-colors rounded-md"
                style={{ color: "var(--fm-text-secondary)" }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
                />
                <span className="truncate">{nb.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
