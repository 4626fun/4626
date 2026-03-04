export const brandTokens = {
  primary: '#0052FF',
  hover: '#004AD9',
  accent: '#3B82F6',
} as const

export const vaultTokens = {
  bg: '#020202',
  card: '#0A0A0A',
  cardRaised: '#0F1014',
  border: '#1F1F1F',
  borderStrong: '#343742',
  text: '#EDEDED',
  subtext: '#666666',
  muted: '#6D7281',
} as const
export const brandColors = {
  brand: {
    primary: '#0052FF',
    hover: '#004AD9',
    accent: '#3B82F6',
    glow: 'rgba(0, 82, 255, 0.15)',
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#3B82F6',
    500: '#0052FF',
    600: '#004AD9',
    700: '#0033CC',
    800: '#0029A3',
    900: '#001F7A',
    950: '#172554',
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
} as const
