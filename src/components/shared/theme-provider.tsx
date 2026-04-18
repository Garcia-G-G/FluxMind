"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  toggleMode: () => {},
  setMode: () => {},
});

export const useFluxTheme = (): ThemeContextValue => useContext(ThemeContext);

const darkTokens: Record<string, string> = {
  "--fm-bg": "#08080c",
  "--fm-bg-secondary": "#0f0f15",
  "--fm-bg-tertiary": "#16161f",
  "--fm-surface": "#1a1a2e",
  "--fm-surface-hover": "#22223a",
  "--fm-surface-border": "rgba(255,255,255,0.06)",
  "--fm-glass-bg": "rgba(20,20,35,0.6)",
  "--fm-glass-backdrop": "blur(20px)",
  "--fm-glass-border": "rgba(255,255,255,0.08)",
  "--fm-text": "#ffffff",
  "--fm-text-secondary": "rgba(255,255,255,0.7)",
  "--fm-text-tertiary": "rgba(255,255,255,0.4)",
  "--fm-accent-orange": "#ff6b35",
  "--fm-accent-rose": "#e11d48",
  "--fm-accent-violet": "#7c3aed",
  "--fm-accent-blue": "#2563eb",
  "--fm-accent-gradient": "linear-gradient(135deg, #ff6b35, #e11d48, #7c3aed, #2563eb)",
  "--fm-accent-gradient-text": "linear-gradient(90deg, #ff6b35, #e11d48, #7c3aed, #2563eb, #ff6b35)",
  "--fm-success": "#22c55e",
  "--fm-warning": "#eab308",
  "--fm-error": "#ef4444",
  "--fm-info": "#3b82f6",
  "--fm-sidebar-bg": "#0c0c12",
  "--fm-sidebar-border": "rgba(255,255,255,0.06)",
  "--fm-header-bg": "#08080c",
  "--fm-header-border": "rgba(255,255,255,0.06)",
  "--fm-input-bg": "rgba(255,255,255,0.04)",
  "--fm-input-border": "rgba(255,255,255,0.08)",
  "--fm-input-focus-border": "#7c3aed",
  "--fm-card-shadow": "0 4px 24px rgba(0,0,0,0.3)",
  "--fm-glow-orange": "rgba(255,107,53,0.3)",
  "--fm-glow-rose": "rgba(225,29,72,0.3)",
  "--fm-glow-violet": "rgba(124,58,237,0.3)",
  "--fm-glow-blue": "rgba(37,99,235,0.3)",
  "--fm-blob1": "rgba(255,107,53,0.12)",
  "--fm-blob2": "rgba(225,29,72,0.10)",
  "--fm-blob3": "rgba(124,58,237,0.10)",
  "--fm-blob4": "rgba(37,99,235,0.08)",
  "--fm-blob5": "rgba(255,107,53,0.06)",
  "--fm-blob6": "rgba(225,29,72,0.06)",
  "--fm-blob7": "rgba(124,58,237,0.05)",
  "--fm-mesh": "rgba(124,58,237,0.06)",
  "--fm-constellation": "rgba(255,255,255,0.15)",
  "--fm-particle": "rgba(255,255,255,0.08)",
  "--fm-godray": "rgba(124,58,237,0.04)",
  "--fm-noise-opacity": "0.03",
};

const lightTokens: Record<string, string> = {
  "--fm-bg": "#f8f7f4",
  "--fm-bg-secondary": "#f0efe9",
  "--fm-bg-tertiary": "#e8e7e0",
  "--fm-surface": "#ffffff",
  "--fm-surface-hover": "#f5f4f0",
  "--fm-surface-border": "rgba(0,0,0,0.08)",
  "--fm-glass-bg": "rgba(255,255,255,0.7)",
  "--fm-glass-backdrop": "blur(20px)",
  "--fm-glass-border": "rgba(0,0,0,0.06)",
  "--fm-text": "#1a1a2e",
  "--fm-text-secondary": "rgba(26,26,46,0.7)",
  "--fm-text-tertiary": "rgba(26,26,46,0.4)",
  "--fm-accent-orange": "#ff6b35",
  "--fm-accent-rose": "#e11d48",
  "--fm-accent-violet": "#7c3aed",
  "--fm-accent-blue": "#2563eb",
  "--fm-accent-gradient": "linear-gradient(135deg, #ff6b35, #e11d48, #7c3aed, #2563eb)",
  "--fm-accent-gradient-text": "linear-gradient(90deg, #ff6b35, #e11d48, #7c3aed, #2563eb, #ff6b35)",
  "--fm-success": "#16a34a",
  "--fm-warning": "#ca8a04",
  "--fm-error": "#dc2626",
  "--fm-info": "#2563eb",
  "--fm-sidebar-bg": "#f8f7f4",
  "--fm-sidebar-border": "rgba(0,0,0,0.06)",
  "--fm-header-bg": "#f8f7f4",
  "--fm-header-border": "rgba(0,0,0,0.06)",
  "--fm-input-bg": "rgba(0,0,0,0.03)",
  "--fm-input-border": "rgba(0,0,0,0.1)",
  "--fm-input-focus-border": "#7c3aed",
  "--fm-card-shadow": "0 4px 24px rgba(0,0,0,0.08)",
  "--fm-glow-orange": "rgba(255,107,53,0.15)",
  "--fm-glow-rose": "rgba(225,29,72,0.15)",
  "--fm-glow-violet": "rgba(124,58,237,0.15)",
  "--fm-glow-blue": "rgba(37,99,235,0.15)",
  "--fm-blob1": "rgba(255,107,53,0.06)",
  "--fm-blob2": "rgba(225,29,72,0.05)",
  "--fm-blob3": "rgba(124,58,237,0.05)",
  "--fm-blob4": "rgba(37,99,235,0.04)",
  "--fm-blob5": "rgba(255,107,53,0.03)",
  "--fm-blob6": "rgba(225,29,72,0.03)",
  "--fm-blob7": "rgba(124,58,237,0.025)",
  "--fm-mesh": "rgba(124,58,237,0.04)",
  "--fm-constellation": "rgba(26,26,46,0.1)",
  "--fm-particle": "rgba(26,26,46,0.05)",
  "--fm-godray": "rgba(124,58,237,0.025)",
  "--fm-noise-opacity": "0.015",
};

const applyTokens = (tokens: Record<string, string>): void => {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
};

export const FluxThemeProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactNode => {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("fm-theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark") {
      setModeState(stored);
      applyTokens(stored === "dark" ? darkTokens : lightTokens);
    } else {
      applyTokens(darkTokens);
    }
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem("fm-theme", newMode);
    applyTokens(newMode === "dark" ? darkTokens : lightTokens);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
