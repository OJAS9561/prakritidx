/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        sage: "#5C7A5A",
        "deep-sage": "#3A4F3A",
        copper: "#B8632F",
        "copper-light": "#D98A4E",
        gold: "#D9A441",
        cream: "#FAF7F0",
        ink: "#2B2B26",
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: "0 8px 30px rgba(43,43,38,0.05)",
        lift: "0 20px 40px rgba(43,43,38,0.08)",
      },
    },
  },
  plugins: [],
};
