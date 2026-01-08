/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Grafana-inspired dark theme
        background: {
          DEFAULT: '#0b0c0e',
          secondary: '#181b1f',
          tertiary: '#1f2229',
        },
        border: {
          DEFAULT: '#2a2e33',
          hover: '#3a3f47',
        },
        text: {
          DEFAULT: '#d8d9da',
          muted: '#8e8e8e',
          dim: '#6e6e6e',
        },
        accent: {
          blue: '#3274d9',
          green: '#73bf69',
          yellow: '#ff9830',
          red: '#f2495c',
          purple: '#b877d9',
          cyan: '#5794f2',
        },
        panel: {
          DEFAULT: '#181b1f',
          hover: '#1f2229',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
