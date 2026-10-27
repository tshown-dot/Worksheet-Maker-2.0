/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        math: ['"KaTeX_Math"', 'Cambria Math', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}
