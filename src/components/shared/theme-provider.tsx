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

/**
 * CSS-only theme switching — tokens live in /styles/theme-tokens.css
 * This provider only toggles `data-theme` on <html>, zero setProperty calls.
 */
export const FluxThemeProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactNode => {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("fm-theme") as ThemeMode | null;
    const initial = stored === "light" || stored === "dark" ? stored : "dark";
    setModeState(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem("fm-theme", newMode);
    document.documentElement.dataset.theme = newMode;
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("fm-theme", next);
      document.documentElement.dataset.theme = next;
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
