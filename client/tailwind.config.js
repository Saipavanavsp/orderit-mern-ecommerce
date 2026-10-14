// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
/** Design tokens: cool, muted, flat. Colors resolve to CSS variables (see src/index.css) for light/dark. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'), // #F8FAFC light / #0F172A dark
        surface: token('surface'), // #FFFFFF / #1E293B
        subtle: token('subtle'),
        line: token('line'), // slate borders
        fg: token('fg'), // slate text
        muted: token('muted'),
        primary: {
          DEFAULT: '#3B6FB6',
          50: '#EEF3FA',
          100: '#D9E4F3',
          600: '#3B6FB6',
          700: '#315D99',
          800: '#284C7D',
        },
        secondary: { DEFAULT: '#2F8F9D', 50: '#EAF5F6', 700: '#26737E' },
        success: { DEFAULT: '#3F8A63', 50: '#ECF5EF' },
        warning: { DEFAULT: '#A27B32', 50: '#F7F1E4' },
        danger: { DEFAULT: '#B25450', 50: '#F8ECEB' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      borderRadius: { DEFAULT: '8px', lg: '10px', xl: '12px' },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.06), 0 1px 3px rgb(15 23 42 / 0.04)',
        pop: '0 8px 24px rgb(15 23 42 / 0.12)',
      },
      maxWidth: { page: '1280px' },
    },
  },
  plugins: [],
};
