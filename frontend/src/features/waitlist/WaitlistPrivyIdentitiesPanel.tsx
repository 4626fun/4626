import { Mail, Pencil } from 'lucide-react'
import { SiApple, SiGoogle, SiTiktok } from 'react-icons/si'

import type { AccountLinkProvider, AccountSetupMe } from '@/features/accountSetup/types'
import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'
import { findLinkedTwitterHandle } from '@/lib/privy/linkedAccounts'
import { cn } from '@/lib/shared/utils'
import { useSafePrivy } from '@/lib/privy/safeHooks'

/** Privy-backed identity channels shown in the waitlist tray Identities section.
 * Wallet/EOA stays under Wallets (CanonicalIdentityDropdown). */
const PRIVY_IDENTITY_PROVIDERS: readonly {
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
]

const PROVIDER_LOGO_SRC: Partial<Record<AccountLinkProvider, string>> = {
  twitter: '/brands/x-logo.svg',
  telegram: '/brands/telegram-logo.svg',
  zora_cross_app: '/brands/zora-token.svg',
}

function shortValue(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 22) return trimmed
  if (trimmed.includes('@') || trimmed.includes('.')) return trimmed
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`
}

function linkedValuesFor(
  accountMe: AccountSetupMe | null,
  provider: AccountLinkProvider,
): string[] {
  if (!accountMe) return []
  if (provider === 'email') {
    const email = accountMe.email?.trim()
    return email ? [email] : []
  }
  if (provider === 'zora_cross_app') {
    const handle = accountMe.accountSignals?.zoraHandle?.trim()
    if (handle) return [handle.startsWith('@') ? handle : `@${handle}`]
    const methods = accountMe.linkedMethods?.zora_cross_app
    return Array.isArray(methods) ? methods.filter(Boolean) : []
  }
  const methods = accountMe.linkedMethods?.[provider]
  return Array.isArray(methods) ? methods.filter(Boolean) : []
}

function ProviderIcon({ provider }: { provider: AccountLinkProvider }) {
  const common = 'flex size-8 shrink-0 items-center justify-center text-zinc-300'
  const logoSrc = PROVIDER_LOGO_SRC[provider]
  if (logoSrc) {
    return (
      <span className={common} aria-hidden="true">
        <img
          src={logoSrc}
          alt=""
          className={cn(
            'object-contain',
            provider === 'zora_cross_app' ? 'size-[15px] rounded-full' : 'size-[15px]',
          )}
          loading="lazy"
        />
      </span>
    )
  }
  if (provider === 'google') {
    return (
      <span className={common} aria-hidden="true">
        <SiGoogle className="size-[15px]" />
      </span>
    )
  }
  if (provider === 'apple') {
    return (
      <span className={common} aria-hidden="true">
        <SiApple className="size-[15px]" />
      </span>
    )
  }
  if (provider === 'tiktok') {
    return (
      <span className={common} aria-hidden="true">
        <SiTiktok className="size-[15px]" />
      </span>
    )
  }
  if (provider === 'email') {
    return (
      <span className={common} aria-hidden="true">
        <Mail className="size-3.5" strokeWidth={1.6} />
      </span>
    )
  }
  const letter = provider.charAt(0).toUpperCase()
  return (
    <span className={cn(common, 'text-[12px] font-semibold')} aria-hidden="true">
      {letter}
    </span>
  )
}

export type WaitlistPrivyIdentitiesPanelProps = {
  accountMe: AccountSetupMe | null
  /** Optional edit for X when linked (waitlist already owns unlink/re-link). */
  onEditTwitter?: () => void
  twitterEditBusy?: boolean
  twitterError?: string | null
}

/**
 * Flat catalog of Privy-supported identity channels for the waitlist tray.
 */
export function WaitlistPrivyIdentitiesPanel({
  accountMe,
  onEditTwitter,
  twitterEditBusy = false,
  twitterError = null,
}: WaitlistPrivyIdentitiesPanelProps) {
  const privy = useSafePrivy()
  const twitterHandle = findLinkedTwitterHandle(privy.user)

  const linkedCount = PRIVY_IDENTITY_PROVIDERS.filter((row) => {
    if (row.provider === 'twitter' && twitterHandle) return true
    return (
      linkedValuesFor(accountMe, row.provider).length > 0 ||
      (row.provider === 'zora_cross_app' && Boolean(accountMe?.accountSignals?.linked))
    )
  }).length

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <span className="text-[11px] tabular-nums text-zinc-600">
          {linkedCount}/{PRIVY_IDENTITY_PROVIDERS.length} linked
        </span>
      </div>

      <ul>
        {PRIVY_IDENTITY_PROVIDERS.map((row) => {
          const values = linkedValuesFor(accountMe, row.provider)
          const twitterLinked =
            row.provider === 'twitter' && (Boolean(twitterHandle) || values.length > 0)
          const zoraLinked =
            row.provider === 'zora_cross_app' &&
            (values.length > 0 || Boolean(accountMe?.accountSignals?.linked))
          const linked =
            row.provider === 'twitter'
              ? twitterLinked
              : row.provider === 'zora_cross_app'
                ? zoraLinked
                : values.length > 0

          const display =
            row.provider === 'twitter' && twitterHandle
              ? `@${twitterHandle}`
              : values.length > 0
                ? values.map(shortValue).join(', ')
                : linked
                  ? 'Linked'
                  : 'Not linked'

          const points = PROVIDER_POINTS[row.provider] ?? null
          const canEditTwitter = row.provider === 'twitter' && linked && Boolean(onEditTwitter)

          return (
            <li key={row.provider} className="border-b border-white/[0.04] last:border-b-0">
              <div className="flex items-center gap-3 py-2.5">
                <ProviderIcon provider={row.provider} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-zinc-100">{row.label}</div>
                  <div
                    className={cn(
                      'truncate text-[12px]',
                      linked ? 'text-zinc-400' : 'text-zinc-600',
                    )}
                  >
                    {display}
                  </div>
                </div>
                {!linked && points !== null ? (
                  <span className="shrink-0 text-[12px] tabular-nums text-zinc-500">+{points}</span>
                ) : linked ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-emerald-400/70" aria-label="Linked" />
                ) : null}
                {canEditTwitter ? (
                  <button
                    type="button"
                    onClick={onEditTwitter}
                    disabled={twitterEditBusy}
                    aria-label="Edit X"
                    className="shrink-0 rounded-full p-1.5 text-zinc-600 transition hover:bg-white/[0.05] hover:text-zinc-300 disabled:opacity-50"
                  >
                    {twitterEditBusy ? (
                      <span className="block size-3.5 animate-spin rounded-full border-[1.5px] border-zinc-500 border-t-transparent" />
                    ) : (
                      <Pencil className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>
              {row.provider === 'twitter' && twitterError ? (
                <p className="pb-2 pl-11 text-[11px] leading-relaxed text-rose-300/90">{twitterError}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
