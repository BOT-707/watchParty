/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        void: '#060608',
        abyss: '#0d0d12',
        surface: '#12121a',
        panel: '#1a1a26',
        border: '#252535',
        muted: '#2e2e45',
        amber: {
          glow: '#f59e0b',
          dim: '#b45309',
          bright: '#fcd34d',
        },
        cyan: {
          glow: '#06b6d4',
          dim: '#0891b2',
        },
        rose: {
          glow: '#f43f5e',
        },
        emerald: {
          glow: '#10b981',
        },
        text: {
          primary: '#f0f0f8',
          secondary: '#9898b8',
          muted: '#5a5a7a',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Outfit', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      boxShadow: {
        'amber-glow': '0 0 20px rgba(245, 158, 11, 0.3)',
        'amber-intense': '0 0 40px rgba(245, 158, 11, 0.5)',
        'cyan-glow': '0 0 20px rgba(6, 182, 212, 0.3)',
        'panel': '0 4px 24px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(245, 158, 11, 0.2)' },
          '50%': { boxShadow: '0 0 30px rgba(245, 158, 11, 0.5)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
