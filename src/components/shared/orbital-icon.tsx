"use client";

import type { LucideIcon } from "lucide-react";

/**
 * OrbitalIcon — static styled icon tile with accent glow. No animations.
 * Performance: zero ongoing CSS animations, zero drop-shadows, zero GPU layers.
 */
export const OrbitalIcon = ({
  icon: Icon,
  accent,
  size = 42,
  className,
}: {
  icon: LucideIcon;
  accent: string;
  size?: number;
  className?: string;
}): React.ReactNode => {
  const iconSize = size * 0.48;
  const radius = size * 0.28;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `${accent}12`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon
        style={{ width: iconSize, height: iconSize, color: accent }}
        strokeWidth={1.8}
      />
    </div>
  );
};
