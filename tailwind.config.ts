import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#201612",
        sand: "#f5efe6",
        clay: "#c2743d",
        ember: "#8c2f1f",
        moss: "#66785f",
        brass: "#b88b3d",
      },
      boxShadow: {
        card: "0 16px 40px rgba(32, 22, 18, 0.12)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)"],
        body: ["var(--font-manrope)"],
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(194, 116, 61, 0.18), transparent 45%), radial-gradient(circle at bottom right, rgba(102, 120, 95, 0.18), transparent 38%)",
      },
    },
  },
  plugins: [forms],
};

export default config;
