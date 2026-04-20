"use client";

/**
 * FluxMind v3 Liquid Background — high-performance animated blobs.
 *
 * Performance strategy:
 * - Radial gradients instead of solid-color + filter:blur().
 *   A gradient is rasterised once and cached by the compositor;
 *   blur() is re-computed every frame → 10× more expensive.
 * - Only transform animations (translate3d) → GPU-composited, zero layout/paint.
 * - contain: strict on wrapper isolates the layer from the rest of the tree.
 * - No SVG filters, no mesh grid, no backdrop-filter.
 * - 3 blobs (down from 4) — the visual difference is negligible but saves a layer.
 */
export const AnimatedBackground = (): React.ReactNode => {
  return (
    <div
      aria-hidden
      className="fm-bg-layers"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        contain: "strict",
        overflow: "hidden",
      }}
    >
      {/* Blob 1 — Orange/warm, top-left */}
      <div
        className="fm-blob fm-blob-1"
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, var(--fm-blob-c1, #ff6b35) 0%, transparent 70%)",
          opacity: "var(--fm-blob-o1, 0.14)",
          top: "-10%",
          left: "0%",
          willChange: "transform",
          transform: "translate3d(0,0,0)",
        }}
      />

      {/* Blob 2 — Violet, right side */}
      <div
        className="fm-blob fm-blob-2"
        style={{
          position: "absolute",
          width: 750,
          height: 750,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, var(--fm-blob-c2, #7c3aed) 0%, transparent 70%)",
          opacity: "var(--fm-blob-o2, 0.12)",
          top: "30%",
          right: "-5%",
          willChange: "transform",
          transform: "translate3d(0,0,0)",
        }}
      />

      {/* Blob 3 — Blue, bottom-left */}
      <div
        className="fm-blob fm-blob-3"
        style={{
          position: "absolute",
          width: 650,
          height: 650,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at center, var(--fm-blob-c3, #2563eb) 0%, transparent 70%)",
          opacity: "var(--fm-blob-o3, 0.12)",
          bottom: "-5%",
          left: "20%",
          willChange: "transform",
          transform: "translate3d(0,0,0)",
        }}
      />
    </div>
  );
};
