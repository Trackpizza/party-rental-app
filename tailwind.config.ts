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
      keyframes: {
        toast: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        toast: 'toast 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
}
export default config
