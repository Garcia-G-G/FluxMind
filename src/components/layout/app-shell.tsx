"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/layout/command-palette";

export const AppShell = ({
  children,
}: {
  children: ReactNode;
}): React.ReactNode => {
  const [commandOpen, setCommandOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sidebarWidth = sidebarCollapsed ? 60 : 240;

  return (
    <div className="min-h-screen" style={{ background: "var(--fm-bg)" }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className="hidden md:flex flex-col min-h-screen transition-[padding-left] duration-200 ease-in-out"
        style={{ paddingLeft: sidebarWidth }}
      >
        <Header
          onOpenCommandPalette={() => setCommandOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <div className="md:hidden flex flex-col min-h-screen">
        <Header onOpenCommandPalette={() => setCommandOpen(true)} />
        <main className="flex-1 p-4">{children}</main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
};
