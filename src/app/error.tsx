"use client";

import { motion } from "motion/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";

const ErrorPage = ({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactNode => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <GlassCard padding="lg">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle
              className="h-12 w-12 mb-4"
              style={{ color: "var(--fm-accent-orange)" }}
            />
            <h1
              className="text-2xl font-bold mb-2"
              style={{
                background: "var(--fm-accent-gradient-text)",
                backgroundSize: "200% auto",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Oops
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--fm-text-secondary)" }}>
              Something went wrong. Don&apos;t worry, your data is safe.
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
              style={{
                background: "var(--fm-accent-gradient)",
                borderRadius: 12,
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default ErrorPage;
