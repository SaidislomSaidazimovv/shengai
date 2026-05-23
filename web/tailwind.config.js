/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        // Clinical palette per the dev handover §10 + deck script design direction.
        bg: "#0a0a0a",
        fg: "#ffffff",
        signal: {
          DEFAULT: "#FF3838",
          50: "#FFE5E5",
          100: "#FFCCCC",
          500: "#FF3838",
          600: "#E61E1E",
        },
        gold: {
          DEFAULT: "#D4A437",
          50: "#FBF1D7",
          100: "#F6E3AE",
          500: "#D4A437",
          600: "#B0871D",
        },
        muted: {
          DEFAULT: "#1a1a1a",
          fg: "#6b6b6b",
        },
        line: "#2a2a2a",
      },
      fontFamily: {
        display: ["'Archivo Narrow'", "'Archivo'", "ui-sans-serif"],
        mono: ["'JetBrains Mono'", "'Söhne Mono'", "ui-monospace", "monospace"],
        cjk: ["'Noto Sans SC'", "'PingFang SC'", "ui-sans-serif"],
        sans: ["'Inter'", "ui-sans-serif", "system-ui"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.025em",
      },
      keyframes: {
        "slam-in": {
          "0%": { transform: "scale(1.06)", opacity: "0" },
          "60%": { transform: "scale(0.985)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "phoneme-tick": {
          "0%, 100%": { opacity: "0.2", transform: "scaleY(0.4)" },
          "50%": { opacity: "1", transform: "scaleY(1)" },
        },
        "wave-pulse": {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(1.6)" },
        },
        "hairline": {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
      },
      animation: {
        "slam-in": "slam-in 280ms cubic-bezier(0.16, 1, 0.3, 1)",
        "scan-line": "scan-line 1.6s linear infinite",
        "phoneme-tick": "phoneme-tick 900ms ease-in-out infinite",
        "wave-pulse": "wave-pulse 600ms ease-in-out infinite",
        "hairline": "hairline 400ms ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
