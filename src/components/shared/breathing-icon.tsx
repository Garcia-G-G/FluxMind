"use client";

import type { LucideIcon } from "lucide-react";

/**
 * BreathingIcon — static styled icon tile. No animations for performance.
 */
export const BreathingIcon = ({
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
