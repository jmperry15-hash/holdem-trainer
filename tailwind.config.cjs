/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        panel: v("panel"),
        line: v("line"),
        felt: v("felt"),
        feltdeep: v("felt-deep"),
        brass: v("brass"),
        brasssoft: v("brass-soft"),
        ivory: v("ivory"),
        ink: v("ink"),
        muted: v("muted"),
        oxblood: v("oxblood"),
        good: v("good"),
        bad: v("bad"),
        warn: v("warn"),
        info: v("info"),
      },
      fontFamily: {
        display: ["Marcellus", "Georgia", "Times New Roman", "serif"],
        sans: ["Manrope", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
