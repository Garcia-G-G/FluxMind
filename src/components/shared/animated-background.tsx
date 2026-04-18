"use client";

import { useEffect, useMemo, useState } from "react";

const BLOB_CONFIG = [
  { size: 900, top: "-10%", left: "-5%", blur: 140, anim: "blob1", dur: "32s", color: "var(--fm-blob1)" },
  { size: 750, top: "20%", right: "-10%", blur: 120, anim: "blob2", dur: "36s", color: "var(--fm-blob2)" },
  { size: 800, top: "50%", left: "50%", blur: 160, anim: "blob4", dur: "44s", color: "var(--fm-blob4)" },
];

const CONSTELLATION_DOTS = Array.from({ length: 24 }, (_, i) => ({
  cx: Math.random() * 100,
  cy: Math.random() * 100,
  anim: `constellationDrift${(i % 3) + 1}`,
  dur: `${30 + (i % 3) * 5}s`,
  delay: `${i * 1.2}s`,
}));

// Tiny base64 noise texture
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;

export const AnimatedBackground = (): React.ReactNode => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent): void => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const constellationLines = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const threshold = 18;
    for (let i = 0; i < CONSTELLATION_DOTS.length; i++) {
      for (let j = i + 1; j < CONSTELLATION_DOTS.length; j++) {
        const dx = CONSTELLATION_DOTS[i].cx - CONSTELLATION_DOTS[j].cx;
        const dy = CONSTELLATION_DOTS[i].cy - CONSTELLATION_DOTS[j].cy;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          lines.push({
            x1: CONSTELLATION_DOTS[i].cx,
            y1: CONSTELLATION_DOTS[i].cy,
            x2: CONSTELLATION_DOTS[j].cx,
            y2: CONSTELLATION_DOTS[j].cy,
          });
        }
      }
    }
    return lines;
  }, []);

  if (reducedMotion) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* Layer 1: Morphing blobs */}
      {BLOB_CONFIG.map((blob, i) => (
        <div
          key={`blob-${i}`}
          style={{
            position: "absolute",
            width: blob.size,
            height: blob.size,
            borderRadius: "50%",
            background: blob.color,
            filter: `blur(${blob.blur}px)`,
            animation: `${blob.anim} ${blob.dur} ease-in-out infinite`,
            top: blob.top,
            left: blob.left,
            right: (blob as Record<string, unknown>).right as string | undefined,
            bottom: (blob as Record<string, unknown>).bottom as string | undefined,
          }}
        />
      ))}

      {/* Layer 2: SVG mesh grid */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          animation: "meshPulse 8s ease-in-out infinite",
        }}
      >
        <defs>
          <pattern id="mesh" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="var(--fm-mesh)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mesh)" />
      </svg>

      {/* Layer 4: Constellation network */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {constellationLines.map((line, i) => (
          <line
            key={`cline-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--fm-constellation)"
            strokeWidth="0.08"
            opacity="0.3"
          />
        ))}
        {CONSTELLATION_DOTS.map((dot, i) => (
          <circle
            key={`cdot-${i}`}
            cx={dot.cx}
            cy={dot.cy}
            r="0.15"
            fill="var(--fm-constellation)"
            style={{
              animation: `${dot.anim} ${dot.dur} ease-in-out infinite`,
              animationDelay: dot.delay,
            }}
          />
        ))}
      </svg>

      {/* Layer 5: Noise grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: NOISE_SVG,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          opacity: "var(--fm-noise-opacity, 0.03)",
        }}
      />

      {/* Layer 7: Bottom gradient wave */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "200px",
          background:
            "linear-gradient(180deg, transparent 0%, var(--fm-bg, #08080c) 100%)",
          animation: "waveShift 20s linear infinite",
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  );
};
