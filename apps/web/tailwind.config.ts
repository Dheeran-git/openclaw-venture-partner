import type { Config } from "tailwindcss";

/**
 * Every utility resolves to a CSS variable from styles/tokens.css.
 * Variable names mirror the design system bundle exactly (--bg-base,
 * --fg-primary, etc). Do not introduce hex literals here.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Background layers (page → elevated → card → hover/selected)
        bg: {
          base: "var(--bg-base)",
          elevated: "var(--bg-elevated)",
          card: "var(--bg-card)",
          hover: "var(--bg-hover)",
          selected: "var(--bg-selected)",
        },
        // Text
        fg: {
          primary: "var(--fg-primary)",
          secondary: "var(--fg-secondary)",
          dim: "var(--fg-dim)",
          "on-coral": "var(--fg-on-coral)",
        },
        // Borders
        "border-subtle": "var(--border-subtle)",
        "border-emphasis": "var(--border-emphasis)",
        "border-focus": "var(--border-focus)",
        // Brand accents
        coral: {
          DEFAULT: "var(--brand-coral)",
          soft: "var(--brand-coral-soft)",
          deep: "var(--brand-coral-deep)",
          darker: "var(--brand-coral-darker)",
        },
        teal: "var(--brand-teal)",
        // Semantic (used for status pills with 10% bg + full color text/border)
        success: {
          DEFAULT: "var(--success)",
          bg: "var(--success-bg)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          bg: "var(--warning-bg)",
        },
        error: {
          DEFAULT: "var(--error)",
          bg: "var(--error-bg)",
        },
        info: {
          DEFAULT: "var(--info)",
          bg: "var(--info-bg)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        "12": ["12px", { lineHeight: "16px" }],
        "14": ["14px", { lineHeight: "20px" }],
        "16": ["16px", { lineHeight: "24px" }],
        "18": ["18px", { lineHeight: "26px" }],
        "20": ["20px", { lineHeight: "28px" }],
        "24": ["24px", { lineHeight: "32px" }],
        "32": ["32px", { lineHeight: "40px" }],
        "48": ["48px", { lineHeight: "56px" }],
      },
      fontWeight: {
        regular: "400",
        medium: "500",
        bold: "700",
      },
      spacing: {
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
        sm: "4px",
        md: "8px",
        lg: "12px",
        full: "999px",
      },
      borderWidth: {
        DEFAULT: "1px",
      },
      maxWidth: {
        content: "var(--content-max)",
      },
      width: {
        sidebar: "var(--sidebar-w)",
      },
      transitionDuration: {
        fast: "80ms",
        base: "140ms",
        slow: "200ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 0.61, 0.36, 1)",
        inout: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      letterSpacing: {
        tight: "-0.02em",
        snug: "-0.01em",
        wide: "0.04em",
        tag: "0.08em",
      },
      boxShadow: {
        popover: "var(--shadow-popover)",
        overlay: "var(--shadow-overlay)",
        "ring-coral": "var(--ring-coral)",
        "selected-inset": "inset 0 0 0 1px var(--brand-coral)",
      },
    },
  },
  plugins: [],
};

export default config;
