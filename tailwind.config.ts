import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16152B",
        paper: "#F7F6FB",
        panel: "#FFFFFF",
        line: "#E3E1F0",
        muted: "#6B6A85",
        brand: "#5B4BFF",
        "brand-soft": "#EEEBFF",
        lol: "#FFD84D",
      },
      fontFamily: {
        sans: ["var(--font-bricolage)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
