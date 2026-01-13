/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3c80fa',
        secondary: '#573cfa',
        accent: '#b63cfa',
        dark: '#0f0c29',
      },
      animation: {
        'shiny': 'shiny 1.5s infinite',
        'slide-in-right': 'slideIn 0.5s ease-out forwards',
      },
      keyframes: {
        shiny: {
          '0%': { left: '-100%' },
          '100%': { left: '200%' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
