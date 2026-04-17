import type { ReactNode } from "react";
import { AnimatedBackground } from "@/components/shared/animated-background";

const AuthLayout = ({ children }: { children: ReactNode }): ReactNode => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <AnimatedBackground />
      <div className="w-full max-w-[420px] relative z-10">
        <div className="flex flex-col items-center mb-8">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{
              background: "var(--fm-accent-gradient-text)",
              backgroundSize: "200% auto",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "gradientShift 3s linear infinite",
            }}
          >
            FluxMind
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--fm-text-secondary)" }}
          >
            Knowledge intelligence platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
