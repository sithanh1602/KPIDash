import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './shared/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0b0d12',
          850: '#10131a',
          800: '#161922',
          750: '#1c202b',
          700: '#232836',
          600: '#2f3546',
          500: '#4a5268',
          400: '#75809c',
          300: '#a3aec8',
          200: '#cbd3e3',
          100: '#e8edf6',
        },
        kpi: {
          green: '#22c55e',
          greenBg: '#14291f',
          greenBorder: '#1e4832',
          gold: '#eab308',
          goldBg: '#2a2412',
          goldBorder: '#4a3e1a',
          red: '#ef4444',
          redBg: '#2c1518',
          redBorder: '#4c2226',
          blue: '#3b82f6',
          purple: '#a855f7',
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [],
} satisfies Config;
