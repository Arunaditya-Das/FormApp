/** @type {import('tailwindcss').Config} */
module.exports = {
  // Add "./app/**/*.{js,jsx,ts,tsx}" to the list
  content: [
    "./app/**/*.{js,jsx,ts,tsx}", 
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}