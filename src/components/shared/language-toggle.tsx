"use client";

import type { ReactNode } from "react";
import { useLanguage, type Language } from "@/lib/i18n/language";

const OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
];

export const LanguageToggle = (): ReactNode => {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center gap-0.5 p-0.5"
      style={{
        border: "1px solid var(--fm-surface-border)",
        borderRadius: 8,
      }}
    >
      {OPTIONS.map((opt) => {
        const active = language === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setLanguage(opt.value)}
            aria-pressed={active}
            aria-label={
              opt.value === "en" ? "Switch to English" : "Switch to Spanish"
            }
            className="text-[11px] font-semibold px-2 h-6 rounded-[6px] transition-colors"
            style={{
              background: active ? "var(--fm-accent-orange)" : "transparent",
              color: active ? "#ffffff" : "var(--fm-text-tertiary)",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.background = "var(--fm-surface-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
