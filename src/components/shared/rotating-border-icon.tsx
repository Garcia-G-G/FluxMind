"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const RotatingBorderIcon = ({
  icon: Icon,
  size = 44,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}): React.ReactNode => {
  const iconSize = size * 0.45;
  const innerSize = size - 4;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center rounded-xl", className)}
      style={{
        width: size,
        height: size,
        background: "conic-gradient(from var(--angle, 0deg), #ff6b35, #e11d48, #7c3aed, #2563eb, #ff6b35)",
        animation: "rotateBorder 6s linear infinite",
      }}
    >
      <div
        className="flex items-center justify-center rounded-[10px]"
        style={{
          width: innerSize,
          height: innerSize,
          background: "var(--fm-surface, #1a1a2e)",
        }}
      >
        <Icon
          style={{ width: iconSize, height: iconSize }}
          className="text-white"
        />
      </div>
    </div>
  );
};
