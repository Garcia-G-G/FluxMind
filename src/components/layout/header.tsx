"use client";

import { Search, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";

export const Header = ({
  onOpenCommandPalette,
}: {
  onOpenCommandPalette: () => void;
}): React.ReactNode => {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="flex items-center gap-2">
        <MobileSidebar />
        <nav className="text-sm text-muted-foreground hidden sm:block">
          <span className="text-foreground font-medium">Dashboard</span>
        </nav>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-muted-foreground h-8 px-3"
          onClick={onOpenCommandPalette}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">Search...</span>
          <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="sm:hidden h-9 w-9 p-0"
          onClick={onOpenCommandPalette}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
