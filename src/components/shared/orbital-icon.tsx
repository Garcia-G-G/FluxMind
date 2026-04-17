"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const OrbitalIcon = ({
  icon: Icon,
  size = 40,
  glowColor = "var(--fm-glow-violet)",
  className,
}: {
  icon: LucideIcon;
  size?: number;
  glowColor?: string;
  className?: string;
}): React.ReactNode => {
  const iconSize = size * 0.5;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Glow background */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: glowColor,
          filter: "blur(12px)",
          animation: "iconGlowPulse 3s ease-in-out infinite",
        }}
      />

      {/* Icon */}
      <Icon
        style={{ width: iconSize, height: iconSize, position: "relative", zIndex: 2 }}
        className="text-white"
      />

      {/* Orbital dot 1 */}
      <div
        className="absolute"
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "var(--fm-accent-orange)",
          top: "50%",
          left: "50%",
          marginTop: -2,
          marginLeft: -2,
          animation: "orbitalSpin 4s linear infinite",
        }}
      />

      {/* Orbital dot 2 */}
      <div
        className="absolute"
        style={{
          width: 3,
          height: 3,
          borderRadius: "50%",
          background: "var(--fm-accent-blue)",
          top: "50%",
          left: "50%",
          marginTop: -1.5,
          marginLeft: -1.5,
          animation: "orbitalSpinReverse 5s linear infinite",
        }}
      />
    </div>
  );
};
