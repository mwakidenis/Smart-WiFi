/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#0a0a0c',
          900: '#0f1115',
          800: '#171923',
        },
        neon: {
          cyan: '#22d3ee',
          emerald: '#10b981',
          violet: '#8b5cf6',
        },
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 50%, #8b5cf6 100%)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(34, 211, 238, 0.35)',
        'neon-violet': '0 0 20px rgba(139, 92, 246, 0.35)',
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 20px rgba(34, 211, 238, 0.35)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 35px rgba(34, 211, 238, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
