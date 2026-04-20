"use client";

import { useId } from "react";
import type { CSSProperties } from "react";

type FluxLogoProps = {
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * FluxMind "Infinity Mind" logo — an elegant infinity loop with gradient
 * stroke on a dark rounded-rect background. The center dot represents
 * the "mind" at the intersection of endless knowledge flow.
 */
export const FluxLogo = ({
  size = 32,
  className,
  style,
}: FluxLogoProps): React.ReactNode => {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient
          id={`fm-inf-${uid}`}
          x1="12"
          y1="24"
          x2="52"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ff6b35" />
          <stop offset="45%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <filter id={`fm-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dark background */}
      <rect width="64" height="64" rx="16" fill="#0c0c12" />

      {/* Subtle inner border */}
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />

      {/* Infinity symbol — smooth, refined path */}
      <path
        d="M18 32
           C18 25.5, 24 21, 30 27
           L32 29.5
           L34 27
           C40 21, 46 25.5, 46 32
           C46 38.5, 40 43, 34 37
           L32 34.5
           L30 37
           C24 43, 18 38.5, 18 32 Z"
        stroke={`url(#fm-inf-${uid})`}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#fm-glow-${uid})`}
      />

      {/* Center "mind" dot */}
      <circle cx="32" cy="32" r="2.2" fill={`url(#fm-inf-${uid})`} />
    </svg>
  );
};
