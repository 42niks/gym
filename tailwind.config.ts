import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff0f0',
          100: '#ffd6d6',
          300: '#ff6b6b',
          400: '#f03232',
          500: '#e00b0b',
          600: '#b80909',
          700: '#8c0707',
          800: '#600505',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#141414',
        },
        page: {
          DEFAULT: '#f5f5f5',
          dark: '#0a0a0a',
        },
        shell: {
          DEFAULT: '#e0e0e0',
          dark: '#000000',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #e00b0b 0%, #8c0707 100%)',
        'brand-gradient-dark': 'linear-gradient(135deg, #b80909 0%, #600505 100%)',
        'hero-gradient': 'linear-gradient(180deg, #e00b0b 0%, #8c0707 60%, #0a0a0a 100%)',
        'hero-gradient-light': 'linear-gradient(180deg, #e00b0b 0%, #b80909 60%, #f5f5f5 100%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
