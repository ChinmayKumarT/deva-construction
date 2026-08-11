import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Stripe-inspired indigo accent -- restrained use (primary actions,
        // active nav, links, small data accents), never a page-scale fill.
        brand: {
          DEFAULT: "#635bff",
          50: "#f5f4ff",
          100: "#ebeafe",
          200: "#d1cffc",
          400: "#8f88fb",
          500: "#635bff",
          600: "#5147e5",
          700: "#4338ca",
          800: "#372da3",
          900: "#2c2482",
        },
        // Dark navy-slate -- reused where a dark surface is still needed
        // (e.g. the sidebar's occasional dark states); no longer the
        // default stat-card treatment, see components/admin/Page.tsx.
        forest: {
          DEFAULT: "#1a1f36",
          50: "#f6f9fc",
          100: "#e3e8ee",
          800: "#151a2e",
          900: "#0f1324",
          950: "#0a0d1a",
        },
        ink: "#1a1f36",
        cream: {
          DEFAULT: "#f6f9fc",
          50: "#fbfcfe",
          100: "#f6f9fc",
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
        // Kept for the marketing showcase page (a Persuade surface) --
        // the admin dashboard (Operate) no longer uses it, see Page.tsx.
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
