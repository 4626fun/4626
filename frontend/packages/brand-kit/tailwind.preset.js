/** @type {import('tailwindcss').Config} */
const preset = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent-rgb) / <alpha-value>)',
        },
        vault: {
          bg: 'rgb(var(--vault-bg) / <alpha-value>)',
          card: 'rgb(var(--vault-card) / <alpha-value>)',
          cardRaised: 'rgb(var(--vault-card-raised) / <alpha-value>)',
          border: 'rgb(var(--vault-border) / <alpha-value>)',
          borderStrong: 'rgb(var(--vault-border-strong) / <alpha-value>)',
          text: 'rgb(var(--vault-text) / <alpha-value>)',
          subtext: 'rgb(var(--vault-subtext) / <alpha-value>)',
          muted: 'rgb(var(--vault-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Space Mono', 'monospace'],
        serif: ['Playfair Display', 'ui-serif', 'Georgia', 'serif'],
        doto: ['Doto', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
}

export default preset
