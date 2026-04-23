import type { Config } from "tailwindcss";

/**
 * MediSlot Tailwind config.
 *
 * All colors/spacing/type/radius/shadow tokens are mirrored from
 * `tokens.css` (the source of truth). If you need to change a value,
 * edit `tokens.css` AND this file — the CSS custom properties are
 * used by unstyled Radix primitives and raw CSS, while the Tailwind
 * scale here is what app code will actually write against.
 *
 * Aesthetic: "Clinical Quiet" — ink blue + sage green + warm paper
 * neutrals, editorial serif display paired with Geist sans/mono.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    // Override the default palette — we want a tight, intentional set,
    // not Tailwind's full rainbow leaking into autocomplete.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",

      primary: {
        50:  "var(--color-primary-50)",
        100: "var(--color-primary-100)",
        200: "var(--color-primary-200)",
        300: "var(--color-primary-300)",
        400: "var(--color-primary-400)",
        500: "var(--color-primary-500)",
        600: "var(--color-primary-600)",
        700: "var(--color-primary-700)",
        800: "var(--color-primary-800)",
        900: "var(--color-primary-900)",
        950: "var(--color-primary-950)",
        DEFAULT: "var(--color-primary-600)",
      },
      sage: {
        50:  "var(--color-sage-50)",
        100: "var(--color-sage-100)",
        200: "var(--color-sage-200)",
        300: "var(--color-sage-300)",
        400: "var(--color-sage-400)",
        500: "var(--color-sage-500)",
        600: "var(--color-sage-600)",
        700: "var(--color-sage-700)",
        800: "var(--color-sage-800)",
        900: "var(--color-sage-900)",
        DEFAULT: "var(--color-sage-500)",
      },
      neutral: {
        0:   "var(--color-neutral-0)",
        50:  "var(--color-neutral-50)",
        100: "var(--color-neutral-100)",
        150: "var(--color-neutral-150)",
        200: "var(--color-neutral-200)",
        300: "var(--color-neutral-300)",
        400: "var(--color-neutral-400)",
        500: "var(--color-neutral-500)",
        600: "var(--color-neutral-600)",
        700: "var(--color-neutral-700)",
        800: "var(--color-neutral-800)",
        900: "var(--color-neutral-900)",
        950: "var(--color-neutral-950)",
      },
      success: {
        bg:     "var(--color-success-bg)",
        border: "var(--color-success-border)",
        fg:     "var(--color-success-fg)",
        solid:  "var(--color-success-solid)",
      },
      warning: {
        bg:     "var(--color-warning-bg)",
        border: "var(--color-warning-border)",
        fg:     "var(--color-warning-fg)",
        solid:  "var(--color-warning-solid)",
      },
      danger: {
        bg:     "var(--color-danger-bg)",
        border: "var(--color-danger-border)",
        fg:     "var(--color-danger-fg)",
        solid:  "var(--color-danger-solid)",
      },
      info: {
        bg:     "var(--color-info-bg)",
        border: "var(--color-info-border)",
        fg:     "var(--color-info-fg)",
      },

      // Semantic aliases — prefer these in component code over raw
      // scale values. Example: `bg-surface-raised`, `text-muted`.
      surface: {
        page:    "var(--surface-page)",
        panel:   "var(--surface-panel)",
        raised:  "var(--surface-raised)",
        sunken:  "var(--surface-sunken)",
        overlay: "var(--surface-overlay)",
        inverse: "var(--surface-inverse)",
      },
      text: {
        primary:  "var(--text-primary)",
        body:     "var(--text-body)",
        muted:    "var(--text-muted)",
        subtle:   "var(--text-subtle)",
        onSolid:  "var(--text-on-solid)",
        link:     "var(--text-link)",
      },
      border: {
        DEFAULT: "var(--border-default)",
        strong:  "var(--border-strong)",
        focus:   "var(--border-focus)",
        inverse: "var(--border-inverse)",
      },
    },

    fontFamily: {
      display: ["Newsreader", "Iowan Old Style", "Georgia", "serif"],
      sans:    ["Geist", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
      mono:    ["Geist Mono", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
    },

    fontSize: {
      "2xs": ["11px", { lineHeight: "1.4" }],
      xs:    ["12px", { lineHeight: "1.4" }],
      sm:    ["13px", { lineHeight: "1.5" }],
      base:  ["14px", { lineHeight: "1.5" }],
      md:    ["15px", { lineHeight: "1.55" }],
      lg:    ["17px", { lineHeight: "1.5" }],
      xl:    ["20px", { lineHeight: "1.4" }],
      "2xl": ["24px", { lineHeight: "1.3" }],
      "3xl": ["30px", { lineHeight: "1.2" }],
      "4xl": ["38px", { lineHeight: "1.15" }],
      "5xl": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
    },

    fontWeight: {
      regular:  "400",
      medium:   "500",
      semibold: "600",
      bold:     "700",
    },

    letterSpacing: {
      tightest: "-0.03em",
      tight:    "-0.015em",
      normal:   "0em",
      wide:     "0.04em",
      widest:   "0.14em",
    },

    extend: {
      // 4px base scale — matches tokens.css `--space-*`
      spacing: {
        px:   "1px",
        0.5:  "2px",
        1:    "4px",
        1.5:  "6px",
        2:    "8px",
        2.5:  "10px",
        3:    "12px",
        4:    "16px",
        5:    "20px",
        6:    "24px",
        7:    "28px",
        8:    "32px",
        10:   "40px",
        12:   "48px",
        16:   "64px",
        20:   "80px",
        24:   "96px",
        topnav:  "var(--layout-topnav)",   // 56px
        sidebar: "var(--layout-sidebar)",  // 232px
      },

      borderRadius: {
        none: "0",
        xs:   "2px",
        sm:   "4px",
        DEFAULT: "6px",
        md:   "6px",
        lg:   "10px",
        xl:   "14px",
        "2xl":"20px",
        full: "9999px",
      },

      boxShadow: {
        xs:      "var(--shadow-xs)",
        sm:      "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md:      "var(--shadow-md)",
        lg:      "var(--shadow-lg)",
        overlay: "var(--shadow-overlay)",
        focus:   "var(--shadow-focus)",
      },

      transitionTimingFunction: {
        out:    "cubic-bezier(0.22, 1, 0.36, 1)",
        inOut:  "cubic-bezier(0.65, 0, 0.35, 1)",
      },

      transitionDuration: {
        instant: "80ms",
        fast:    "140ms",
        base:    "200ms",
        slow:    "320ms",
      },

      maxWidth: {
        content: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
