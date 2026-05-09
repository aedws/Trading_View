import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0e1a",
          card: "#111726",
          soft: "#1a2238",
          panel: "#111726",
          subtle: "#1a2238",
        },
        border: {
          DEFAULT: "#1f2a44",
          soft: "#283354",
        },
        ink: {
          DEFAULT: "#e5e7eb",
          muted: "#9ca3af",
          dim: "#6b7280",
        },
        accent: {
          DEFAULT: "#3b82f6",
          green: "#22c55e",
          red: "#ef4444",
          blue: "#3b82f6",
          purple: "#a855f7",
          yellow: "#eab308",
          cyan: "#06b6d4",
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', "Pretendard", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
