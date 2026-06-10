import { useMemo, type CSSProperties } from 'react'

import {
  getEthosScoreAccentHex,
  getEthosScorePalette,
  useEthosScoreForUserkey,
  type EthosScorePalette,
  type EthosScoreValue,
} from '@/components/chat/EthosScorePill'
import { buildEthosSocialUserkeyFromZoraProfile } from '@/lib/ethos/zoraSocial'
import type { ZoraProfile } from '@/lib/zora/types'

export type EthosPageTheme = {
  isActive: boolean
  palette: EthosScorePalette
  accentHex: string
  levelLabel: string
  ambientLayerStyle: CSSProperties
  heroWashStyle: CSSProperties
  orbTopStyle: CSSProperties
  orbBottomStyle: CSSProperties
  cardBorderClass: string
  cardSurfaceClass: string
  accentTextClass: string
  accentStrongTextClass: string
  primaryCtaStyle: CSSProperties
  primaryCtaHoverClass: string
  outlineCtaClass: string
  dividerStyle: CSSProperties
}

const DEFAULT_ACCENT = '#3b82f6'
const DEFAULT_ACCENT_SECONDARY = '#38bdf8'

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length !== 6) return null
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if (![r, g, b].every((channel) => Number.isFinite(channel))) return null
  return { r, g, b }
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(59, 130, 246, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function shiftAccentHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return DEFAULT_ACCENT_SECONDARY
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  const toHex = (value: number) => clamp(value).toString(16).padStart(2, '0')
  return `#${toHex(rgb.r + amount)}${toHex(rgb.g + amount)}${toHex(rgb.b + amount)}`
}

const DEFAULT_PALETTE = getEthosScorePalette(null, null)

function buildDefaultTheme(): EthosPageTheme {
  return {
    isActive: false,
    palette: DEFAULT_PALETTE,
    accentHex: DEFAULT_ACCENT,
    levelLabel: 'Neutral',
    ambientLayerStyle: {
      background:
        'radial-gradient(circle at 20% 12%, rgba(59,130,246,0.12), transparent 50%), radial-gradient(circle at 82% 78%, rgba(56,189,248,0.1), transparent 52%)',
    },
    heroWashStyle: {},
    orbTopStyle: { backgroundColor: 'rgba(59, 130, 246, 0.14)' },
    orbBottomStyle: { backgroundColor: 'rgba(56, 189, 248, 0.12)' },
    cardBorderClass: 'border-white/8',
    cardSurfaceClass: 'bg-white/4',
    accentTextClass: 'text-zinc-400',
    accentStrongTextClass: 'text-white',
    primaryCtaStyle: {},
    primaryCtaHoverClass: 'hover:bg-white/90',
    outlineCtaClass: 'border-white/20 text-white hover:bg-white/10',
    dividerStyle: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  }
}

const DEFAULT_THEME = buildDefaultTheme()

export function buildEthosPageTheme(score: EthosScoreValue | null | undefined): EthosPageTheme {
  const scoreValue = typeof score?.score === 'number' ? score.score : null
  const hasPositiveScore = scoreValue != null && scoreValue > 0
  if (!hasPositiveScore) return DEFAULT_THEME

  const palette = getEthosScorePalette(score?.score ?? null, score?.level ?? null)
  const accentHex = getEthosScoreAccentHex(score?.score ?? null, score?.level ?? null)
  const accentSecondary = shiftAccentHex(accentHex, 18)

  return {
    isActive: true,
    palette,
    accentHex,
    levelLabel: palette.level,
    ambientLayerStyle: {
      background: [
        `radial-gradient(circle at 18% 10%, ${rgba(accentHex, 0.22)}, transparent 52%)`,
        `radial-gradient(circle at 84% 78%, ${rgba(accentSecondary, 0.16)}, transparent 54%)`,
        `radial-gradient(circle at 50% 120%, ${rgba(accentHex, 0.08)}, transparent 48%)`,
      ].join(', '),
    },
    heroWashStyle: {
      background: [
        `linear-gradient(120deg, ${rgba(accentHex, 0.28)} 0%, transparent 42%)`,
        `linear-gradient(0deg, ${rgba(accentHex, 0.12)} 0%, transparent 38%)`,
      ].join(', '),
    },
    orbTopStyle: { backgroundColor: rgba(accentHex, 0.2) },
    orbBottomStyle: { backgroundColor: rgba(accentSecondary, 0.16) },
    cardBorderClass: palette.borderClass,
    cardSurfaceClass: palette.bgClass,
    accentTextClass: palette.textClass,
    accentStrongTextClass: palette.strongTextClass,
    primaryCtaStyle: { backgroundColor: accentHex, color: '#ffffff' },
    primaryCtaHoverClass: 'hover:brightness-110',
    outlineCtaClass: `${palette.borderClass} ${palette.textClass} border hover:bg-white/8`,
    dividerStyle: { backgroundColor: rgba(accentHex, 0.35) },
  }
}

export function resolveCreatorEthosUserkey(
  profile: ZoraProfile | null | undefined,
  creatorAddress: string | null | undefined,
): string | null {
  const social = buildEthosSocialUserkeyFromZoraProfile(profile ?? undefined)
  if (social) return social
  const creator = typeof creatorAddress === 'string' ? creatorAddress.trim().toLowerCase() : ''
  if (/^0x[a-f0-9]{40}$/.test(creator)) return `address:${creator}`
  return null
}

function hasFiniteServerEthosScore(score: number | null | undefined): score is number {
  return typeof score === 'number' && Number.isFinite(score)
}

export function useCreatorEthosPageTheme(params: {
  profile?: ZoraProfile | null
  creatorAddress?: string | null
  serverEthosScore?: number | null
  serverEthosLevel?: string | null
}) {
  const ethosUserkey = useMemo(
    () => resolveCreatorEthosUserkey(params.profile, params.creatorAddress),
    [params.profile, params.creatorAddress],
  )
  const serverEthosScore = useMemo((): EthosScoreValue | null => {
    if (!hasFiniteServerEthosScore(params.serverEthosScore)) return null
    return {
      score: params.serverEthosScore,
      level: typeof params.serverEthosLevel === 'string' ? params.serverEthosLevel : null,
    }
  }, [params.serverEthosLevel, params.serverEthosScore])
  const ethosScoreQuery = useEthosScoreForUserkey(serverEthosScore ? null : ethosUserkey)
  const ethosScore = serverEthosScore ?? ethosScoreQuery.data ?? null
  const theme = useMemo(() => buildEthosPageTheme(ethosScore), [ethosScore])
  const scoreValue = typeof ethosScore?.score === 'number' ? ethosScore.score : null
  const hasPositiveScore = scoreValue != null && scoreValue > 0

  return {
    ethosUserkey,
    ethosScore,
    theme,
    hasPositiveScore,
    isLoading: serverEthosScore ? false : ethosScoreQuery.isLoading,
  }
}
