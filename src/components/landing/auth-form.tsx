"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "login" | "signup";

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

export const AuthForm = (): ReactNode => {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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

  return (
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
        {mode === "login" ? "Sign in to continue" : "Create your FluxMind account"}
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
          style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }}
        />
        or
        <div
          style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }}
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
  );
};
