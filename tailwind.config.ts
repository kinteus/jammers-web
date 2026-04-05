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
        ink: "#1C1C1C",
        sand: "#F4F4F4",
        blue: "#003DA5",
        red: "#B90016",
        mist: "#181818",
        cloud: "#3A3A3A",
        stage: "#101010",
        ember: "#D73A14",
        moss: "#3A4D85",
        clay: "#7A2A1F",
        brass: "#FFB300",
        gold: "#FFB300",
        yellow: "#FFB300",
        brand: {
          gold: "#FFB300",
          yellow: "#FFB300",
          red: "#B90016",
          blue: "#003DA5",
          ink: "#1C1C1C",
          sand: "#F4F4F4",
        },
        surface: {
          subtle: "#1F1F1F",
          raised: "#242424",
        },
        line: {
          soft: "#4A4A4A",
          strong: "#A8A8A8",
        },
      },
      boxShadow: {
        card: "0 22px 48px rgba(0, 0, 0, 0.44)",
        "table-glow": "0 28px 70px rgba(0, 0, 0, 0.4)",
        sticky: "16px 0 20px -18px rgba(0, 0, 0, 0.45)",
        glow: "0 0 0 1px rgba(255, 179, 0, 0.12), 0 16px 38px rgba(185, 0, 22, 0.28)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)"],
        body: ["var(--font-manrope)"],
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(0, 61, 165, 0.2), transparent 30%), radial-gradient(circle at top right, rgba(185, 0, 22, 0.26), transparent 34%), radial-gradient(circle at bottom left, rgba(255, 179, 0, 0.14), transparent 26%), linear-gradient(180deg, rgba(16, 16, 16, 1), rgba(28, 28, 28, 1))",
        "brand-wave":
          "linear-gradient(115deg, rgba(255, 179, 0, 1), rgba(215, 58, 20, 0.96) 38%, rgba(185, 0, 22, 0.96) 64%, rgba(0, 61, 165, 0.88) 100%)",
        "header-rule":
          "linear-gradient(115deg, rgba(255, 179, 0, 1), rgba(215, 58, 20, 0.96) 38%, rgba(185, 0, 22, 0.96) 64%, rgba(0, 61, 165, 0.88) 100%)",
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
      },
      animation: {
        floaty: "floaty 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [forms],
};

export default config;
