/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marca CEM AUSTROGAS
        brand: {
          primary: '#0a6b3b',
          primaryHover: '#085c33',
        },
        // Tonos de estado para fichas
        status: {
          successFg: '#0a6b3b',
          successBg: '#e6f6ee',
          successBar: '#10a05a',
          warningFg: '#8a4a0a',
          warningBg: '#fff4e3',
          warningBar: '#e08a2c',
          dangerFg:  '#a01f2a',
          dangerBg:  '#fce8eb',
          dangerBar: '#dc2e3c',
          mutedFg:   '#3a4a5e',
          mutedBg:   '#eef1f5',
          mutedBar:  '#94a2b3',
        },
      },
      fontFamily: {
        sans: ["'Public Sans'", 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
