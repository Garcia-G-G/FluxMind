"use client";

import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type GlassCardProps = {
  children: ReactNode;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
  className?: string;
};

const paddingMap = {
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, hover = false, padding = "md", className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl",
          paddingMap[padding],
          hover && "transition-transform duration-300 hover:-translate-y-1",
          className
        )}
        style={{
          background: "var(--fm-glass-bg)",
          border: "1px solid var(--fm-glass-border)",
        }}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
