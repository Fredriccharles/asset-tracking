/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Primary brand accent — derived from the logo's blue, deepened and
        // desaturated slightly so it reads as a professional enterprise
        // accent rather than a bright "app" blue. Used for primary actions,
        // active nav state, links, and focus rings — nothing else.
        brand: {
          50: '#eff4fb',
          100: '#dce7f5',
          200: '#b9cfea',
          300: '#8fb0da',
          400: '#5c88c4',
          500: '#3a67ab',
          600: '#2c5290',
          700: '#234173',
          800: '#1c355c',
          900: '#152a49',
          950: '#0e1c33',
        },
        // Restrained success green (checkout/available/completed states only)
        success: {
          50: '#eef7f1',
          100: '#d7ecdd',
          200: '#aed9ba',
          600: '#3d7a52',
          700: '#316342',
        },
        // Restrained danger red (destructive actions / blocking states only)
        danger: {
          50: '#fbeeee',
          100: '#f3d6d5',
          200: '#e5aeac',
          600: '#a13c3a',
          700: '#84302e',
        },
        // Cool neutral scale (slate-leaning gray) for surfaces, borders, text
        neutral: {
          50: '#f7f8fa',
          100: '#eef0f3',
          200: '#dfe3e8',
          300: '#c5cbd3',
          400: '#9aa3b0',
          500: '#707a89',
          600: '#525b69',
          700: '#3c4351',
          800: '#262b35',
          900: '#161a21',
          950: '#0c0e12',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
};
