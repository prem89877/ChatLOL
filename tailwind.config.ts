import type { Config } from "tailwindcss";

const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: c("canvas"),
        panel: c("panel"),
        side: c("side"),
        line: c("line"),
        ink: c("ink"),
        muted: c("muted"),
        brand: c("brand"),
        onbrand: c("onbrand"),
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
