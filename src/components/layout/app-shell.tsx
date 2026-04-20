"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AnimatedBackground } from "@/components/shared/animated-background";

const CommandPalette = dynamic(
  () => import("@/components/layout/command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);

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
    <div className="min-h-screen relative" style={{ background: "var(--fm-bg)" }}>
      <AnimatedBackground />
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className="flex flex-col min-h-screen transition-[padding-left] duration-200 ease-in-out"
        style={{ paddingLeft: `var(--fm-sidebar-pad, 0px)` }}
      >
        <style>{`
          @media (min-width: 768px) {
            :root { --fm-sidebar-pad: ${sidebarWidth}px; }
          }
        `}</style>
        <Header
          onOpenCommandPalette={() => setCommandOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      {commandOpen && (
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      )}
    </div>
  );
};
