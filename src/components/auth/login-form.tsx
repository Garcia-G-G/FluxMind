"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Loader2, LogIn } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signIn } from "@/lib/auth-client";
import { loginSchema } from "@/lib/validations/auth";
import { SocialButtons } from "@/components/auth/social-buttons";
import { GlassCard } from "@/components/shared/glass-card";
import { OrbitalIcon } from "@/components/shared/orbital-icon";

export const LoginForm = (): React.ReactNode => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    try {
      const { error: authError } = await signIn.email({
        email,
        password,
        callbackURL: callbackUrl,
      });
      if (authError) {
        setError(authError.message ?? "Invalid email or password");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--fm-input-bg)",
    border: "1px solid var(--fm-input-border)",
    borderRadius: 10,
    color: "var(--fm-text)",
    padding: "10px 14px",
    fontSize: 14,
    width: "100%",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <GlassCard padding="lg">
        <div className="flex flex-col items-center mb-6">
          <OrbitalIcon icon={LogIn} size={48} glowColor="var(--fm-glow-violet)" />
          <h2
            className="text-xl font-semibold mt-4"
            style={{
              background: "var(--fm-accent-gradient-text)",
              backgroundSize: "200% auto",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "gradientShift 3s linear infinite",
            }}
          >
            Welcome back
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--fm-text-secondary)" }}>
            Sign in to your account
          </p>
        </div>

        <div className="grid gap-4">
          <SocialButtons
            callbackUrl={callbackUrl}
            disabled={isLoading}
            onError={(msg) => setError(msg)}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" style={{ background: "var(--fm-surface-border)" }} />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="px-2" style={{ background: "var(--fm-glass-bg)", color: "var(--fm-text-tertiary)" }}>
                Or continue with
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" style={{ color: "var(--fm-text-secondary)", fontSize: 13 }}>
                Email
              </Label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                style={inputStyle}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--fm-input-focus-border)";
                  e.target.style.boxShadow = "0 0 0 3px var(--fm-glow-violet)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--fm-input-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" style={{ color: "var(--fm-text-secondary)", fontSize: 13 }}>
                Password
              </Label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--fm-input-focus-border)";
                    e.target.style.boxShadow = "0 0 0 3px var(--fm-glow-violet)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--fm-input-border)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: "var(--fm-text-tertiary)" }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-center" style={{ color: "var(--fm-error)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-50 transition-transform hover:-translate-y-0.5"
              style={{
                background: "var(--fm-accent-gradient)",
                borderRadius: 12,
                padding: "12px 0",
              }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-sm text-center mt-6" style={{ color: "var(--fm-text-tertiary)" }}>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="hover:underline"
            style={{ color: "var(--fm-accent-violet)" }}
          >
            Sign up
          </Link>
        </p>
      </GlassCard>
    </motion.div>
  );
};
