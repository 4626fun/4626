import type { AccountLinkProvider, AccountSetupMe } from '@/features/accountSetup/types'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'

/** Social/recovery channels counted in the waitlist tray Connections row. */
export const TRAY_CONNECTION_PROVIDERS: readonly {
  provider: AccountLinkProvider
  label: string
}[] = [
  { provider: 'email', label: 'Email' },
  { provider: 'google', label: 'Google' },
  { provider: 'apple', label: 'Apple' },
  { provider: 'twitter', label: 'X' },
  { provider: 'telegram', label: 'Telegram' },
  { provider: 'tiktok', label: 'TikTok' },
  { provider: 'zora_cross_app', label: 'Zora' },
] as const

export const TRAY_CONNECTIONS_TOTAL = TRAY_CONNECTION_PROVIDERS.length

function isProviderLinked(
  accountMe: AccountSetupMe | null | undefined,
  provider: AccountLinkProvider,
): boolean {
  if (!accountMe) return false
  if (provider === 'email') {
    return Boolean(accountMe.email?.trim())
  }
  if (provider === 'zora_cross_app') {
    if (accountMe.accountSignals?.zoraHandle?.trim()) return true
    return (accountMe.linkedMethods?.zora_cross_app ?? []).length > 0
  }
  return (accountMe.linkedMethods?.[provider] ?? []).length > 0
}

export function summarizeTrayConnections(accountMe: AccountSetupMe | null | undefined): {
  linked: number
  total: number
  nextBonus: { label: string; points: number } | null
} {
  let linked = 0
  let nextBonus: { label: string; points: number } | null = null
  for (const row of TRAY_CONNECTION_PROVIDERS) {
    if (isProviderLinked(accountMe, row.provider)) {
      linked += 1
      continue
    }
    if (!nextBonus) {
      const points = PROVIDER_POINTS[row.provider]
      if (typeof points === 'number' && points > 0) {
        nextBonus = { label: `Connect ${row.label}`, points }
      }
    }
  }
  return { linked, total: TRAY_CONNECTIONS_TOTAL, nextBonus }
}
