"use client";

import { Sparkles, Sun, Cpu } from "lucide-react";
import { clsx } from "clsx";
import { useTheme, THEMES, type Theme } from "@/lib/theme";

const ICONS: Record<Theme, typeof Sparkles> = {
  neon: Sparkles,
  aurora: Sun,
  mono: Cpu,
};

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-edge bg-surface/60 backdrop-blur-xl p-1",
        className
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      {THEMES.map(({ id, label, description }) => {
        const Icon = ICONS[id];
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${label} — ${description}`}
            onClick={() => setTheme(id)}
            className={clsx(
              "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
              active
                ? "bg-gradient-to-br from-accent to-accent2 text-accent-fg shadow-[0_0_16px_-2px_rgb(var(--accent)/0.7)]"
                : "text-muted hover:text-fg hover:bg-surface-2"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
