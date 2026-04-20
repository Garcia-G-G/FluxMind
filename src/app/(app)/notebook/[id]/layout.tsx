"use client";

import { use, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Wand2, Layers } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SourcePanel } from "@/components/notebook/source-panel";

const tabs = [
  { href: "", icon: MessageSquare, label: "Chat" },
  { href: "/studio", icon: Wand2, label: "Studio" },
  { href: "/canvas", icon: Layers, label: "Canvas" },
];

const NotebookLayout = ({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}): ReactNode => {
  const { id } = use(params);
  const pathname = usePathname();
  const [sourcePanelOpen, setSourcePanelOpen] = useState(true);

  const basePath = `/notebook/${id}`;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6">
      {/* Source Panel — wider for usability */}
      {sourcePanelOpen && (
        <div
          className="hidden md:block w-80 lg:w-[340px] shrink-0 overflow-hidden"
          style={{
            borderRight: "1px solid var(--fm-surface-border)",
            background: "var(--fm-bg-secondary, var(--fm-bg))",
          }}
        >
          <SourcePanel notebookId={id} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tabs */}
        <div
          className="flex items-center gap-1 px-4 pt-3 pb-0"
          style={{ borderBottom: "1px solid var(--fm-surface-border)" }}
        >
          {tabs.map((tab) => {
            const tabPath = `${basePath}${tab.href}`;
            const isActive =
              tab.href === ""
                ? pathname === basePath
                : pathname.startsWith(tabPath);
            return (
              <Link
                key={tab.label}
                href={tabPath}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors -mb-px",
                  isActive ? "font-medium" : ""
                )}
                style={{
                  color: isActive ? "var(--fm-text)" : "var(--fm-text-tertiary)",
                  borderBottom: isActive ? "2px solid var(--fm-accent-orange)" : "2px solid transparent",
                }}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}

          <button
            onClick={() => setSourcePanelOpen(!sourcePanelOpen)}
            className="ml-auto text-xs transition-colors px-2 py-1 hidden md:block"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
            {sourcePanelOpen ? "Hide sources" : "Show sources"}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
};

export default NotebookLayout;
