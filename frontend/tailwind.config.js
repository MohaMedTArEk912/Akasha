/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // IDE Dark Theme Colors
        'ide-bg': '#0f0f1a',
        'ide-sidebar': '#141422',
        'ide-panel': '#1a1a2e',
        'ide-border': '#2a2a4a',
        'ide-accent': '#6366f1',
        'ide-accent-hover': '#818cf8',
        'ide-text': '#e2e8f0',
        'ide-text-muted': '#94a3b8',
        'ide-success': '#22c55e',
        'ide-warning': '#f59e0b',
        'ide-error': '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
