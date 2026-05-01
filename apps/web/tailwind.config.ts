import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Background layers
        bg: {
          page: "var(--bg-page)",
          elevated: "var(--bg-elevated)",
          card: "var(--bg-card)",
          hover: "var(--bg-hover)",
        },
        // Text
        fg: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
        // Borders
        border: {
          subtle: "var(--border-subtle)",
          emphasis: "var(--border-emphasis)",
        },
        // Brand accents
        coral: {
          DEFAULT: "var(--brand-coral)",
          soft: "var(--brand-coral-soft)",
          deep: "var(--brand-coral-deep)",
          darker: "var(--brand-coral-darker)",
        },
        teal: {
          DEFAULT: "var(--brand-teal)",
        },
        // Semantic
        success: "var(--semantic-success)",
        warning: "var(--semantic-warning)",
        error: "var(--semantic-error)",
        info: "var(--semantic-info)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["12px", { lineHeight: "16px" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "26px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["32px", { lineHeight: "40px" }],
        "4xl": ["48px", { lineHeight: "56px" }],
      },
      spacing: {
        "0.5": "2px",
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
        "16": "64px",
      },
      borderRadius: {
        sm: "8px",
        DEFAULT: "8px",
        md: "8px",
        lg: "12px",
        full: "999px",
      },
      transitionDuration: {
        "80": "80ms",
        "140": "140ms",
        "200": "200ms",
      },
      transitionTimingFunction: {
        "ease-out-snap": "cubic-bezier(0.22, 0.61, 0.36, 1)",
        "ease-state": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      letterSpacing: {
        tight: "-0.02em",
        tag: "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;
