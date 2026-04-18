"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Home } from "lucide-react";

const NotFoundPage = (): React.ReactNode => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Floating orbs */}
      {[
        { size: 300, top: "10%", left: "15%", color: "var(--fm-blob1)", dur: "20s" },
        { size: 200, top: "60%", right: "10%", color: "var(--fm-blob2)", dur: "25s" },
        { size: 250, bottom: "15%", left: "50%", color: "var(--fm-blob3)", dur: "30s" },
      ].map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            right: (orb as Record<string, unknown>).right as string | undefined,
            bottom: (orb as Record<string, unknown>).bottom as string | undefined,
            background: orb.color,
            filter: "blur(80px)",
            animation: `blob${i + 1} ${orb.dur} ease-in-out infinite`,
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="text-center relative z-10"
      >
        <h1
          className="text-8xl font-bold mb-4"
          style={{
            background: "var(--fm-accent-gradient-text)",
            backgroundSize: "200% auto",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "gradientShift 3s linear infinite",
          }}
        >
          404
        </h1>
        <p className="text-lg mb-2" style={{ color: "var(--fm-text)" }}>
          Page not found
        </p>
        <p className="text-sm mb-8" style={{ color: "var(--fm-text-secondary)" }}>
          This page wandered off into the void.
        </p>
        <Link href="/">
          <button
            className="flex items-center gap-2 mx-auto px-6 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
            style={{
              background: "var(--fm-accent-gradient)",
              borderRadius: 12,
            }}
          >
            <Home className="h-4 w-4" />
            Go Home
          </button>
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
