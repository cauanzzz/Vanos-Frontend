const { colors } = require('./src/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Web loads NativeWind's color scheme flag after the runtime observer starts.
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { colors } },
  plugins: [],
};
