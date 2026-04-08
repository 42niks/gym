import type { Config } from 'tailwindcss';

const withOpacity = (variableName: string) => `rgb(var(${variableName}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: withOpacity('--gray-50'),
          100: withOpacity('--gray-100'),
          200: withOpacity('--gray-200'),
          300: withOpacity('--gray-300'),
          400: withOpacity('--gray-400'),
          500: withOpacity('--gray-500'),
          600: withOpacity('--gray-600'),
          700: withOpacity('--gray-700'),
          800: withOpacity('--gray-800'),
          900: withOpacity('--gray-900'),
          950: withOpacity('--gray-950'),
        },
        brand: {
          50: withOpacity('--color-brand-50'),
          100: withOpacity('--color-brand-100'),
          300: withOpacity('--color-brand-300'),
          400: withOpacity('--color-brand-400'),
          500: withOpacity('--color-brand-500'),
          600: withOpacity('--color-brand-600'),
          700: withOpacity('--color-brand-700'),
          800: withOpacity('--color-brand-800'),
        },
        accent: {
          50: withOpacity('--color-accent-50'),
          100: withOpacity('--color-accent-100'),
          300: withOpacity('--color-accent-300'),
          400: withOpacity('--color-accent-400'),
          500: withOpacity('--color-accent-500'),
          600: withOpacity('--color-accent-600'),
          700: withOpacity('--color-accent-700'),
        },
        energy: {
          50: withOpacity('--color-energy-50'),
          100: withOpacity('--color-energy-100'),
          300: withOpacity('--color-energy-300'),
          400: withOpacity('--color-energy-400'),
          500: withOpacity('--color-energy-500'),
        },
        surface: {
          DEFAULT: withOpacity('--surface-card'),
          dark: withOpacity('--surface-dark'),
          raised: withOpacity('--surface-raised'),
          inverse: withOpacity('--surface-inverse'),
        },
        page: {
          DEFAULT: withOpacity('--surface-page'),
          dark: withOpacity('--surface-page'),
        },
        shell: {
          DEFAULT: withOpacity('--surface-shell'),
          dark: withOpacity('--surface-shell'),
        },
        line: withOpacity('--line-soft'),
        ink: withOpacity('--ink'),
      },
      backgroundImage: {
        'brand-gradient': 'radial-gradient(circle at top left, rgba(255,81,250,0.28), transparent 42%), radial-gradient(circle at bottom right, rgba(0,237,180,0.28), transparent 48%)',
        'brand-gradient-dark': 'radial-gradient(circle at top left, rgba(255,81,250,0.34), transparent 42%), radial-gradient(circle at bottom right, rgba(0,237,180,0.30), transparent 48%)',
        'hero-mesh':
          'radial-gradient(circle at top left, rgba(var(--color-accent-500), 0.18), transparent 34%), radial-gradient(circle at top right, rgba(var(--color-brand-400), 0.22), transparent 32%), linear-gradient(180deg, rgba(var(--surface-page), 0.98) 0%, rgba(var(--surface-shell), 0.95) 100%)',
        'hero-grid':
          'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
      },
      boxShadow: {
        panel: '0 18px 50px rgba(14, 14, 15, 0.08)',
        glass: '0 10px 30px rgba(14, 14, 15, 0.08)',
        'glow-brand': '0 18px 38px rgba(0, 237, 180, 0.13)',
        'glow-accent': '0 18px 38px rgba(255, 81, 250, 0.12)',
      },
      borderRadius: {
        shell: '2rem',
      },
      fontFamily: {
        headline: ['"Space Grotesk"', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        label: ['"Space Grotesk"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
