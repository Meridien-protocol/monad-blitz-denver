import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        meridian: {
          gold: "#D4A853",
          "gold-dim": "rgba(212, 168, 83, 0.4)",
          "gold-faint": "rgba(212, 168, 83, 0.15)",
          bg: "#0A0A0F",
          surface: "#12121A",
          border: "#1E1E2A",
        },
        yes: "#22C55E",
        no: "#EF4444",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
