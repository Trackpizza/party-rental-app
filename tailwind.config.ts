import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1a1a1a',
        brand: '#7c2d91',
      },
    },
  },
  plugins: [],
}
export default config
