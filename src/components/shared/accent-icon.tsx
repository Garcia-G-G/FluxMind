"use client";

import type { LucideIcon } from "lucide-react";

/**
 * AccentIcon — clean, minimal icon tile with subtle colored background.
 * Replaces OrbitalIcon, BreathingIcon, and RotatingBorderIcon.
 */
export const AccentIcon = ({
  icon: Icon,
  accent,
  size = 38,
  className,
}: {
  icon: LucideIcon;
  accent: string;
  size?: number;
  className?: string;
}): React.ReactNode => {
  const iconSize = size * 0.48;
  const radius = size >= 40 ? 14 : 11;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "transform 0.2s ease",
      }}
    >
      <Icon
        style={{
          width: iconSize,
          height: iconSize,
          color: accent,
        }}
        strokeWidth={1.8}
      />
    </div>
  );
};
