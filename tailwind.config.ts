import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Blue accent -- replaces the old green brand identity.
        brand: {
          DEFAULT: "#7da3d6",
          50: "#eff4fa",
          100: "#dce7f3",
          200: "#bfd4ea",
          400: "#93b6de",
          500: "#7da3d6",
          600: "#6c93c9",
          700: "#5c89c4",
          800: "#4a70a3",
          900: "#395580",
        },
        // Near-black dark-card tone -- used for the stat-card / dark-panel
        // treatment (UNIX-style bold numbers on dark background). Same slot
        // that used to hold the green "forest" dark accent.
        forest: {
          DEFAULT: "#242424",
          50: "#f2f1ef",
          100: "#dcdad7",
          800: "#1a1a1a",
          900: "#141414",
          950: "#0d0d0d",
        },
        ink: "#232323",
        cream: {
          DEFAULT: "#e8e1da",
          50: "#f6f3ef",
          100: "#efe9e2",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "Inter",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        // Wired to next/font/google in app/layout.tsx as --font-fraunces.
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
