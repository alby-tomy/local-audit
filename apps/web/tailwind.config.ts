import type { Config } from "tailwindcss";

const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["selector", '[data-theme="neon"], [data-theme="mono"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens — actual values are defined per data-theme
        // in globals.css as `--base`, `--accent`, etc. (RGB triplets), so
        // the same `bg-surface` / `text-fg` classes render correctly across
        // all three themes (neon / aurora / mono).
        base: withAlpha("--base"),
        "base-2": withAlpha("--base-2"),
        surface: withAlpha("--surface"),
        "surface-2": withAlpha("--surface-2"),
        fg: withAlpha("--fg"),
        muted: withAlpha("--muted"),
        edge: withAlpha("--edge"),
        accent: withAlpha("--accent"),
        accent2: withAlpha("--accent-2"),
        "accent-fg": withAlpha("--accent-fg"),
        // Legacy alias kept so any un-migrated `brand-*` class still resolves
        // sensibly to the active theme's accent color.
        brand: {
          50: withAlpha("--accent"),
          100: withAlpha("--accent"),
          500: withAlpha("--accent"),
          600: withAlpha("--accent"),
          700: withAlpha("--accent"),
          900: withAlpha("--accent-2"),
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      keyframes: {
        "drift-slow": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(40px, 30px) scale(1.08)" },
        },
        "drift-slower": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-50px, 40px) scale(1.12)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "drift-slow": "drift-slow 22s ease-in-out infinite",
        "drift-slower": "drift-slower 28s ease-in-out infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 2.5s linear infinite",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, transparent, rgb(var(--base)) 90%), repeating-linear-gradient(to right, rgb(var(--edge) / 0.25) 0 1px, transparent 1px 64px), repeating-linear-gradient(to bottom, rgb(var(--edge) / 0.25) 0 1px, transparent 1px 64px)",
      },
    },
  },
  plugins: [],
};

export default config;
