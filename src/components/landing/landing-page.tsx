"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { FluxLogo } from "@/components/shared/flux-logo";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "login" | "signup";

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

const GoogleIcon = (): ReactNode => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
    />
  </svg>
);

const GithubIcon = (): ReactNode => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fill="#ffffff"
      d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.33.96.1-.74.4-1.25.72-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.13 0 .31.21.67.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
    />
  </svg>
);

export const LandingPage = (): ReactNode => {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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

  const switchMode = useCallback(() => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setError(null);
  }, []);

  const handleGoogle = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await signIn.social({ provider: "google", callbackURL: "/dashboard" });
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }, []);

  const handleGithub = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await signIn.social({ provider: "github", callbackURL: "/dashboard" });
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      setError(null);
      if (!email || !password) {
        setError("Please enter email and password");
        return;
      }
      if (password.length < 8 && mode === "signup") {
        setError("Password must be at least 8 characters");
        return;
      }
      setIsLoading(true);
      try {
        if (mode === "login") {
          const { error: authError } = await signIn.email({
            email,
            password,
            callbackURL: "/dashboard",
          });
          if (authError) {
            setError(authError.message ?? "Sign in failed");
          } else {
            router.push("/dashboard");
            router.refresh();
          }
        } else {
          const name = email.split("@")[0] || "User";
          const { error: authError } = await signUp.email({
            email,
            password,
            name,
            callbackURL: "/dashboard",
          });
          if (authError) {
            setError(authError.message ?? "Sign up failed");
          } else {
            router.push("/dashboard");
            router.refresh();
          }
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, mode, router],
  );

  const inputStyle = (focused: boolean): CSSProperties => ({
    width: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    borderBottom: `1px solid ${focused ? "rgba(255,107,53,0.6)" : "rgba(255,255,255,0.08)"}`,
    padding: "12px 0",
    fontSize: 15,
    fontWeight: 300,
    color: "white",
    transition: "border-color 0.2s",
  });

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
            willChange: "transform",
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
            willChange: "transform",
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
            willChange: "transform",
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
            <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.25)" }}>
              {" with "}
            </span>
            <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.25)" }}>
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
                  color: "rgba(255,255,255,0.22)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {pill}
              </span>
            ))}
          </div>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.18)",
              marginTop: 36,
              fontWeight: 350,
              letterSpacing: "-0.01em",
            }}
          >
            Open beta · Free while in preview
          </p>
        </section>

        {/* Right: auth card */}
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
          <div
            style={{
              background: "rgba(12,12,18,0.88)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 16,
              padding: "40px 36px",
            }}
          >
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "white",
                marginBottom: 4,
              }}
            >
              {mode === "login" ? "Welcome back" : "Get started"}
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              {mode === "login"
                ? "Sign in to continue"
                : "Create your FluxMind account"}
            </p>

            <button
              type="button"
              onClick={switchMode}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                marginTop: 8,
                marginBottom: 28,
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {mode === "login" ? "New here? " : "Have an account? "}
              <span className="fm-landing-mode-accent">
                {mode === "login" ? "Create an account" : "Sign in"}
              </span>
            </button>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <button
                type="button"
                onClick={handleGoogle}
                className="fm-landing-oauth"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "white",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <GoogleIcon />
                Google
              </button>
              <button
                type="button"
                onClick={handleGithub}
                className="fm-landing-oauth"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "white",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <GithubIcon />
                GitHub
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 20,
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: "rgba(255,255,255,0.06)",
                }}
              />
              or
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: "rgba(255,255,255,0.06)",
                }}
              />
            </div>

            <form onSubmit={handleSubmit}>
              <input
                className="fm-landing-input"
                type="email"
                placeholder="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                style={{ ...inputStyle(emailFocused), marginBottom: 8 }}
              />
              <input
                className="fm-landing-input"
                type="password"
                placeholder="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                style={inputStyle(passwordFocused)}
              />

              <button
                type="submit"
                disabled={isLoading}
                className="fm-landing-cta"
                style={{
                  background: "#ff6b35",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 0",
                  fontSize: 14,
                  fontWeight: 500,
                  width: "100%",
                  marginTop: 24,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: isLoading ? 0.85 : 1,
                }}
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : mode === "login" ? (
                  "Continue"
                ) : (
                  "Get started"
                )}
              </button>

              {error ? (
                <p
                  style={{
                    fontSize: 12,
                    color: "rgba(255,80,80,0.8)",
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  {error}
                </p>
              ) : null}
            </form>
          </div>
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
