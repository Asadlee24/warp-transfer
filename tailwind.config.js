/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a12",
        panel: "#12121e",
      },
      fontFamily: {
        display: ["Unbounded", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        aurora: {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(40px,-30px) scale(1.15)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: 0.6 },
          "50%": { opacity: 1 },
        },
      },
      animation: {
        aurora1: "aurora 14s ease-in-out infinite",
        aurora2: "aurora 18s ease-in-out infinite reverse",
        aurora3: "aurora 22s ease-in-out infinite",
        pulseGlow: "pulseGlow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
