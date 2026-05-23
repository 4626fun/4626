import type { ReactNode } from 'react'

import { formatDateLabel, formatUsd, parseNumber } from '@/features/explore/exploreShared'

export type CreatorStatKind = 'currency' | 'integer' | 'date' | 'text'

export type CreatorStatItem = {
  id: string
  label: string
  kind: CreatorStatKind
  raw?: number | null
  display: string
  toneClass: string
  valueClassName?: string
  footer?: ReactNode
  /** When true, label is clickable (volume window toggle). */
  toggleable?: boolean
}

export type VolumeWindow = '24h' | 'all'

export type BuildCreatorStatsInput = {
  volume24h?: string | number | null
  totalVolume?: string | number | null
  marketCap?: string | number | null
  uniqueHolders?: number | null
  ethosScore?: number | null
  ethosHasPositiveScore: boolean
  ethosAccentClass: string
  coinsCreated: number
  createdAt?: string | null
  volumeWindow: VolumeWindow
  ethosFooter?: ReactNode
}

function formatCurrencyDisplay(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return formatUsd(value)
}

function formatIntegerDisplay(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return value.toLocaleString(undefined, { useGrouping: true, maximumFractionDigits: 0 })
}

function formatEthosDisplay(value: number | null | undefined, hasPositiveScore: boolean): string {
  if (!hasPositiveScore || value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { useGrouping: false })
}

/** Format a partial numeric value during GSAP tween. */
export function formatAnimatedStatValue(kind: CreatorStatKind, value: number): string {
  if (kind === 'currency') return formatCurrencyDisplay(value)
  if (kind === 'integer') return formatIntegerDisplay(Math.round(value))
  return String(value)
}

function diceRollHash(seed: number, tick: number): number {
  const x = Math.sin(seed * 12.9898 + tick * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const DICE_ROLL_SETTLE_START = 0.58

/**
 * Scroll-scrubbed odometer: flickering pseudo-random values during enter, then ease to target.
 * Deterministic from focus + stat index so scrub stays in sync.
 */
export function getDiceRollStatDisplay(
  stat: Pick<CreatorStatItem, 'kind' | 'raw' | 'display'>,
  focus: number,
  statIndex: number,
): string {
  const clampedFocus = Math.max(0, Math.min(1, focus))
  if (clampedFocus >= 0.985) return stat.display

  if (stat.kind === 'date' || stat.kind === 'text') {
    if (clampedFocus < 0.25) return '—'
    if (clampedFocus < DICE_ROLL_SETTLE_START) {
      const tick = Math.floor(clampedFocus * 18)
      const chars = stat.display.split('')
      return chars
        .map((char, charIndex) => {
          if (!/\d/.test(char)) return char
          const roll = Math.floor(diceRollHash(statIndex * 31 + charIndex, tick) * 10)
          return String(roll)
        })
        .join('')
    }
    return stat.display
  }

  const raw = stat.raw
  if (raw == null || !Number.isFinite(raw) || raw <= 0) {
    return clampedFocus >= 0.5 ? stat.display : '—'
  }

  if (clampedFocus >= DICE_ROLL_SETTLE_START) {
    const settleT = (clampedFocus - DICE_ROLL_SETTLE_START) / (1 - DICE_ROLL_SETTLE_START)
    const eased = 1 - Math.pow(1 - settleT, 2.8)
    return formatAnimatedStatValue(stat.kind, raw * eased)
  }

  const tick = Math.floor(clampedFocus * 28)
  const flicker = diceRollHash(statIndex + raw * 0.017, tick)
  const ceiling = raw * (0.08 + flicker * 0.92)
  return formatAnimatedStatValue(stat.kind, ceiling)
}

export function buildCreatorStats(input: BuildCreatorStatsInput): CreatorStatItem[] {
  const volumeRaw =
    input.volumeWindow === '24h' ? parseNumber(input.volume24h) : parseNumber(input.totalVolume)
  const marketCapRaw = parseNumber(input.marketCap)
  const holdersRaw = input.uniqueHolders ?? 0
  const ethosRaw = input.ethosHasPositiveScore ? (input.ethosScore ?? null) : null
  const coinsCreatedRaw = input.coinsCreated

  return [
    {
      id: 'volume',
      label: input.volumeWindow === '24h' ? '24H volume' : 'All-time volume',
      kind: 'currency',
      raw: volumeRaw > 0 ? volumeRaw : null,
      display: formatCurrencyDisplay(volumeRaw),
      toneClass: 'text-white',
      toggleable: true,
    },
    {
      id: 'marketCap',
      label: 'Market cap',
      kind: 'currency',
      raw: marketCapRaw > 0 ? marketCapRaw : null,
      display: formatCurrencyDisplay(marketCapRaw),
      toneClass: 'text-white',
    },
    {
      id: 'holders',
      label: 'Holders',
      kind: 'integer',
      raw: holdersRaw > 0 ? holdersRaw : null,
      display: holdersRaw > 0 ? holdersRaw.toLocaleString() : '-',
      toneClass: 'text-white',
    },
    {
      id: 'ethos',
      label: 'Ethos score',
      kind: 'integer',
      raw: ethosRaw,
      display: formatEthosDisplay(input.ethosScore, input.ethosHasPositiveScore),
      toneClass: input.ethosHasPositiveScore ? input.ethosAccentClass : 'text-zinc-500',
      footer: input.ethosFooter ?? null,
    },
    {
      id: 'coinsCreated',
      label: 'Coins created',
      kind: 'integer',
      raw: coinsCreatedRaw > 0 ? coinsCreatedRaw : null,
      display: coinsCreatedRaw > 0 ? String(coinsCreatedRaw) : '-',
      toneClass: 'text-white',
    },
    {
      id: 'created',
      label: 'Created',
      kind: 'date',
      display: formatDateLabel(input.createdAt ?? undefined),
      toneClass: 'text-white',
      valueClassName: 'whitespace-nowrap tracking-normal',
    },
  ]
}

/** Rail-friendly shape (value + label) derived from CreatorStatItem. */
export function toStatsRailItems(stats: CreatorStatItem[]): Array<{
  value: string | number
  label: string
  toneClass: string
  footer?: ReactNode
  valueClassName?: string
}> {
  return stats.map((stat) => ({
    value: stat.display,
    label: stat.label,
    toneClass: stat.toneClass,
    footer: stat.footer,
    valueClassName: stat.valueClassName,
  }))
}
