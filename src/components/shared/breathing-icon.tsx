"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const BreathingIcon = ({
  icon: Icon,
  size = 36,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}): React.ReactNode => {
  const iconSize = size * 0.55;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{
        width: size,
        height: size,
        animation: "breathingScale 4s ease-in-out infinite",
      }}
    >
      <Icon
        style={{
          width: iconSize,
          height: iconSize,
          animation: "innerGlowPulse 4s ease-in-out infinite",
        }}
        className="text-white"
      />
    </div>
  );
};
