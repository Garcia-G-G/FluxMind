"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Compass,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { useSession } from "@/lib/auth-client";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/dashboard", icon: BookOpen, label: "All Notebooks" },
  { href: "/dashboard", icon: Compass, label: "Explore" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

export const Sidebar = ({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}): React.ReactNode => {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const { data: session } = useSession();

  return (
    <motion.aside
      animate={{ width: collapsed ? 60 : 240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="hidden md:flex flex-col h-screen border-r border-border bg-card fixed left-0 top-0 z-30"
    >
      <div className="flex items-center h-14 px-3 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">F</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-semibold text-sm whitespace-nowrap"
            >
              FluxMind
            </motion.span>
          )}
        </Link>
      </div>

      <nav className="flex-1 py-2 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2 space-y-1">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors w-full"
        >
          <Sun className="h-4 w-4 shrink-0 dark:hidden" />
          <Moon className="h-4 w-4 shrink-0 hidden dark:block" />
          {!collapsed && <span className="whitespace-nowrap">Toggle theme</span>}
        </button>

        <div className="flex items-center gap-3 px-2.5 py-1.5">
          <UserMenu />
          {!collapsed && session?.user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="overflow-hidden"
            >
              <p className="text-sm font-medium truncate leading-tight">
                {session.user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate leading-tight">
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
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </motion.aside>
  );
};
