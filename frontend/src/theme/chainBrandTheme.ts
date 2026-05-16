import { DEFAULT_CHAIN_ID } from '@/config/chains'

type ChainBrandTheme = {
  primary: string
  hover: string
  accent: string
}

const BASE_THEME: ChainBrandTheme = {
  // Base network context (exact Base blue).
  primary: '0 82 255',
  hover: '26 102 255',
  accent: '245 158 11',
}

const PRODUCT_THEME: ChainBrandTheme = {
  // 4626 product identity (default when not chain-contextual).
  primary: '28 92 242',
  hover: '63 129 255',
  accent: '245 158 11',
}

const CHAIN_THEME_BY_ID: Record<number, ChainBrandTheme> = {
  // Base
  8453: BASE_THEME,
  // Ethereum
  1: {
    primary: '108 92 231',
    hover: '145 131 250',
    accent: '245 158 11',
  },
  // Arbitrum
  42161: {
    primary: '23 145 222',
    hover: '57 178 242',
    accent: '245 158 11',
  },
  // Optimism
  10: {
    primary: '224 77 89',
    hover: '240 109 119',
    accent: '245 158 11',
  },
  // Polygon
  137: {
    primary: '139 92 246',
    hover: '167 126 250',
    accent: '245 158 11',
  },
}

export function resolveChainBrandTheme(chainId?: number | null): ChainBrandTheme {
  if (chainId && CHAIN_THEME_BY_ID[chainId]) return CHAIN_THEME_BY_ID[chainId]
  if (chainId === DEFAULT_CHAIN_ID) return BASE_THEME
  return PRODUCT_THEME
}

export function applyChainBrandTheme(theme: ChainBrandTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--brand-primary', theme.primary)
  root.style.setProperty('--brand-hover', theme.hover)
  root.style.setProperty('--brand-glow', theme.primary)
  root.style.setProperty('--brand-accent-rgb', theme.accent)
}
