/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#B8860B',
        'primary-hover': '#9A6F08',
        'primary-light': '#D4A843',
        gold: {
          50: '#FDF8F0',
          100: '#F5E6CC',
          200: '#E8D5A3',
          300: '#D4A843',
          400: '#C49830',
          500: '#B8860B',
          600: '#9A6F08',
          700: '#8B6914',
          800: '#6B4F0C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
