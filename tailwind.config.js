/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#ee7b22',
          teal: '#1ebcb2',
          purple: '#641f60',
          gray: '#dae1e1',
          mint: '#7eccc6',
          rust: '#c46040',
        },
      },
    },
  },
  plugins: [],
};
