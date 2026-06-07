"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "neon" | "aurora" | "mono";

export const THEMES: { id: Theme; label: string; description: string }[] = [
  { id: "neon", label: "Neon", description: "Dark cyberpunk — glass & glow" },
  { id: "aurora", label: "Aurora", description: "Light futuristic gradients" },
  { id: "mono", label: "Mono", description: "Dark minimal monochrome" },
];

const STORAGE_KEY = "localaudit-theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("neon");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && THEMES.some((t) => t.id === stored)) {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/** Inline script string injected before hydration to prevent a flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('${STORAGE_KEY}');
  var valid = ['neon', 'aurora', 'mono'];
  document.documentElement.setAttribute('data-theme', valid.indexOf(t) > -1 ? t : 'neon');
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'neon');
}
`;
