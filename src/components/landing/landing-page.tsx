"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { FluxLogo } from "@/components/shared/flux-logo";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const AuthForm = dynamic(
  () => import("./auth-form").then((m) => m.AuthForm),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        style={{
          background: "rgba(12,12,18,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 16,
          height: 400,
        }}
      />
    ),
  },
);

const PILL_BASE_STYLE: CSSProperties = {
  borderRadius: 100,
  padding: "6px 14px",
  fontSize: 12,
  background: "transparent",
  transition: "color 0.3s, border-color 0.3s",
};

const FEATURED_PILLS = ["Cited RAG Chat", "AI Podcasts", "Mind Maps"] as const;
const SECONDARY_PILLS = [
  "Video Overviews",
  "Infographics",
  "Slide Decks",
  "Flashcards",
  "Quizzes",
  "Deep Research",
  "Mini-Courses",
  "Newsletters",
  "Reel Scripts",
] as const;

export const LandingPage = (): ReactNode => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const targetMouse = useRef({ x: 0.5, y: 0.5 });
  const currentMouse = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    // Skip the mouse-follow aurora entirely if the user prefers reduced
    // motion. This loop ticks every frame and drives three large surfaces,
    // so gating it is significant on lower-end devices.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const el = containerRef.current;
    const onMove = (e: MouseEvent): void => {
      targetMouse.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const tick = (): void => {
      const t = 0.04;
      const prevX = currentMouse.current.x;
      const prevY = currentMouse.current.y;
      currentMouse.current.x += (targetMouse.current.x - prevX) * t;
      currentMouse.current.y += (targetMouse.current.y - prevY) * t;
      // Only write to the DOM if the eased position moved meaningfully —
      // skips style recalc / compositor work when the cursor is idle.
      if (
        el &&
        (Math.abs(currentMouse.current.x - prevX) > 0.0005 ||
          Math.abs(currentMouse.current.y - prevY) > 0.0005)
      ) {
        el.style.setProperty("--mx", currentMouse.current.x.toFixed(4));
        el.style.setProperty("--my", currentMouse.current.y.toFixed(4));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen relative z-10 flex flex-col"
      style={{ background: "#08080c" }}
    >
      <style>{`
        @keyframes auroraBreath {
          0%, 100% { transform: scale(1) rotate(0deg); }
          33% { transform: scale(1.08) rotate(3deg); }
          66% { transform: scale(0.95) rotate(-2deg); }
        }
        @keyframes auroraBreath2 {
          0%, 100% { transform: scale(1) rotate(0deg); }
          40% { transform: scale(1.12) rotate(-4deg); }
          70% { transform: scale(0.92) rotate(2deg); }
        }
        @keyframes auroraBreath3 {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.06) rotate(5deg); }
        }
        .fm-landing-input::placeholder { color: rgba(255,255,255,0.2); }
        .fm-landing-nav-link { color: rgba(255,255,255,0.35); transition: color 0.3s; }
        .fm-landing-nav-link:hover { color: rgba(255,255,255,0.7); }
        .fm-landing-pill { transition: color 0.3s, border-color 0.3s; }
        .fm-landing-pill:hover { color: rgba(255,255,255,0.7) !important; border-color: rgba(255,107,53,0.2) !important; }
        .fm-landing-oauth { transition: background 0.2s, border-color 0.2s; }
        .fm-landing-oauth:hover { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.1) !important; }
        .fm-landing-cta { transition: filter 0.2s, transform 0.2s; }
        .fm-landing-cta:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .fm-landing-mode-accent { color: #ff6b35; transition: filter 0.2s; }
        .fm-landing-mode-accent:hover { filter: brightness(1.2); }
        .fm-landing-footer-link { color: white; transition: opacity 0.2s; pointer-events: auto; }
        .fm-landing-footer-link:hover { opacity: 1; }
      `}</style>

      {/* Aurora — 3 blobs, mouse-reactive. Uses radial-gradient instead of
          filter: blur() — a gradient is rasterised once and cached by the
          compositor, while filter: blur() recomputes every frame. Same
          visual at 1/10 the GPU cost. See AnimatedBackground for the same
          pattern. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
          contain: "strict",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "calc(20% + (var(--mx, 0.5) - 0.5) * 20%)",
            top: "calc(25% + (var(--my, 0.5) - 0.5) * 15%)",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at center, rgba(255,107,53,0.22) 0%, transparent 70%)",
            animation: "auroraBreath 25s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "calc(45% + (var(--mx, 0.5) - 0.5) * 10%)",
            top: "calc(40% + (var(--my, 0.5) - 0.5) * 8%)",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at center, rgba(124,58,237,0.18) 0%, transparent 70%)",
            animation: "auroraBreath2 30s ease-in-out 3s infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "calc(30% + (var(--mx, 0.5) - 0.5) * 5%)",
            top: "calc(55% + (var(--my, 0.5) - 0.5) * 5%)",
            width: 350,
            height: 350,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at center, rgba(225,29,72,0.14) 0%, transparent 70%)",
            animation: "auroraBreath3 20s ease-in-out 6s infinite",
          }}
        />
      </div>

      {/* Nav */}
      <nav
        className="flex items-center justify-between px-8 py-6 relative z-20"
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.8s ease 0.2s",
        }}
      >
        <Link href="/" className="flex items-center" style={{ gap: 10 }}>
          <FluxLogo size={28} />
          <span style={{ fontSize: 15, fontWeight: 500, color: "white" }}>
            FluxMind
          </span>
        </Link>
        <div style={{ display: "flex", gap: 32 }}>
          <a href="#" className="fm-landing-nav-link" style={{ fontSize: 13 }}>
            Features
          </a>
          <Link
            href="/pricing"
            className="fm-landing-nav-link"
            style={{ fontSize: 13 }}
          >
            Pricing
          </Link>
          <a href="#" className="fm-landing-nav-link" style={{ fontSize: 13 }}>
            Changelog
          </a>
        </div>
      </nav>

      {/* Main */}
      <main
        className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-16 items-center px-8 lg:px-16 py-12 flex-1 max-w-[1280px] w-full mx-auto relative z-10"
      >
        {/* Left: hero */}
        <section
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(24px)",
            transition:
              "opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 40,
                height: 1,
                background:
                  "linear-gradient(90deg, #ff6b35, transparent)",
                transformOrigin: "left",
                transform: loaded ? "scaleX(1)" : "scaleX(0)",
                transition: "transform 0.6s ease 0.6s",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              Knowledge Intelligence
            </span>
          </div>

          <h1
            style={{
              fontSize: 64,
              letterSpacing: "-0.045em",
              lineHeight: 1.05,
              color: "white",
              margin: 0,
            }}
          >
            <span style={{ fontWeight: 700, color: "white" }}>Think deeper</span>
            <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.5)" }}>
              {" with "}
            </span>
            <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.5)" }}>
              everything you{" "}
            </span>
            <span style={{ fontWeight: 700, color: "white" }}>know.</span>
          </h1>

          <p
            style={{
              fontSize: 16,
              fontWeight: 380,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.4)",
              maxWidth: 440,
              marginTop: 24,
            }}
          >
            Upload your research. Chat with cited answers. Generate podcasts,
            mind maps, slides, and twelve more formats — all grounded in your
            sources.
          </p>

          <div className="flex flex-wrap gap-2" style={{ marginTop: 40 }}>
            {FEATURED_PILLS.map((pill) => (
              <span
                key={pill}
                className="fm-landing-pill"
                style={{
                  ...PILL_BASE_STYLE,
                  color: "rgba(255,255,255,0.5)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {pill}
              </span>
            ))}
            {SECONDARY_PILLS.map((pill) => (
              <span
                key={pill}
                className="fm-landing-pill"
                style={{
                  ...PILL_BASE_STYLE,
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {pill}
              </span>
            ))}
          </div>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.4)",
              marginTop: 36,
              fontWeight: 350,
              letterSpacing: "-0.01em",
            }}
          >
            Open beta · Free while in preview
          </p>
        </section>

        {/* Right: auth card — lazy-loaded client island */}
        <section
          style={{
            width: 380,
            maxWidth: "100%",
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(32px)",
            transition:
              "opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s",
          }}
        >
          <AuthForm />
        </section>
      </main>

      {/* Footer */}
      <footer
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "24px 32px",
          zIndex: 10,
          pointerEvents: "none",
          borderTop: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <div
          style={{
            opacity: 0.1,
            fontSize: 11,
            color: "white",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>&copy; 2026 FluxMind</span>
          <div style={{ display: "flex", gap: 16 }}>
            <a
              href="#"
              className="fm-landing-footer-link"
              style={{ color: "white" }}
            >
              Twitter
            </a>
            <a
              href="#"
              className="fm-landing-footer-link"
              style={{ color: "white" }}
            >
              GitHub
            </a>
            <a
              href="#"
              className="fm-landing-footer-link"
              style={{ color: "white" }}
            >
              Discord
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
