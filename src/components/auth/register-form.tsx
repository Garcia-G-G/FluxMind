"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2, UserPlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signUp } from "@/lib/auth-client";
import { registerSchema } from "@/lib/validations/auth";
import { SocialButtons } from "@/components/auth/social-buttons";
import { GlassCard } from "@/components/shared/glass-card";
import { OrbitalIcon } from "@/components/shared/orbital-icon";

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

const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>): void => {
    e.target.style.borderColor = "var(--fm-input-focus-border)";
    e.target.style.boxShadow = "0 0 0 3px var(--fm-glow-violet)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement>): void => {
    e.target.style.borderColor = "var(--fm-input-border)";
    e.target.style.boxShadow = "none";
  },
};

export const RegisterForm = (): React.ReactNode => {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = registerSchema.safeParse({ name, email, password, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const err of result.error.errors) {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const { error: authError } = await signUp.email({
        name,
        email,
        password,
        callbackURL: "/dashboard",
      });
      if (authError) {
        setError(authError.message ?? "Registration failed");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fm-fade-in"
    >
      <GlassCard padding="lg">
        <div className="flex flex-col items-center mb-6">
          <OrbitalIcon icon={UserPlus} size={48} accent="#ff6b35" />
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
            Create an account
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--fm-text-secondary)" }}>
            Get started with FluxMind
          </p>
        </div>

        <div className="grid gap-4">
          <SocialButtons callbackUrl="/dashboard" disabled={isLoading} onError={(msg) => setError(msg)} />

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

          <form onSubmit={handleSubmit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label style={{ color: "var(--fm-text-secondary)", fontSize: 13 }}>Name</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" disabled={isLoading} autoComplete="name" style={inputStyle} {...focusHandlers} />
              {fieldErrors.name && <p className="text-xs" style={{ color: "var(--fm-error)" }}>{fieldErrors.name}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label style={{ color: "var(--fm-text-secondary)", fontSize: 13 }}>Email</Label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={isLoading} autoComplete="email" style={inputStyle} {...focusHandlers} />
              {fieldErrors.email && <p className="text-xs" style={{ color: "var(--fm-error)" }}>{fieldErrors.email}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label style={{ color: "var(--fm-text-secondary)", fontSize: 13 }}>Password</Label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" disabled={isLoading} autoComplete="new-password" style={inputStyle} {...focusHandlers} />
              {fieldErrors.password && <p className="text-xs" style={{ color: "var(--fm-error)" }}>{fieldErrors.password}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label style={{ color: "var(--fm-text-secondary)", fontSize: 13 }}>Confirm password</Label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password" disabled={isLoading} autoComplete="new-password" style={inputStyle} {...focusHandlers} />
              {fieldErrors.confirmPassword && <p className="text-xs" style={{ color: "var(--fm-error)" }}>{fieldErrors.confirmPassword}</p>}
            </div>

            {error && <p className="text-sm text-center" style={{ color: "var(--fm-error)" }}>{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white disabled:opacity-50 transition-transform hover:-translate-y-0.5 mt-1"
              style={{ background: "var(--fm-accent-gradient)", borderRadius: 12, padding: "12px 0" }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-sm text-center mt-6" style={{ color: "var(--fm-text-tertiary)" }}>
          Already have an account?{" "}
          <Link href="/login" className="hover:underline" style={{ color: "var(--fm-accent-violet)" }}>
            Sign in
          </Link>
        </p>
      </GlassCard>
    </div>
  );
};
