import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // FTC-inspired color palette
        ftc: {
          orange: "#f57e25",
          blue: "#0066b3",
          dark: "#1a1a2e",
        },
      },
    },
  },
  plugins: [],
};

export default config;
