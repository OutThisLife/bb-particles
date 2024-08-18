import type { Config } from 'tailwindcss'

const gridSteps = Object.fromEntries(
  Array.from({ length: 10 }, (_, i) => [i, `${i} / ${i * -1}`])
)

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
      },
      gridTemplateColumns: { 40: 'repeat(40, minmax(0, 1fr))' },
      gridTemplateRows: { 40: 'repeat(40, minmax(0, 1fr))' }
    },
    gridColumn: gridSteps,
    gridRow: gridSteps
  },
  plugins: []
}
export default config
