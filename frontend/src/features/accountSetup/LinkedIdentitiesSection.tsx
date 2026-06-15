import { Apple, Mail, Music, Send, Twitter, Wallet, type LucideIcon } from 'lucide-react'

import { PROVIDER_POINTS } from '@/features/waitlist/waitlistTiers'
import { shortValue } from './shared'
import type { AccountLinkProvider } from './types'
import type { useAccountSetupController } from './useAccountSetupController'

const PROVIDER_ICON: Record<AccountLinkProvider, LucideIcon | null> = {
  email: Mail,
  apple: Apple,
  twitter: Twitter,
  telegram: Send,
  tiktok: Music,
  external_eoa: Wallet,
  google: null,
  zora_cross_app: null,
}

const PROVIDER_LOGO_SRC: Partial<Record<AccountLinkProvider, string>> = {
  zora_cross_app: '/brands/zora-token.svg',
  twitter: '/brands/x-logo.svg',
  telegram: '/brands/telegram-logo.svg',
}

function resolveProviderLogoSrc(input: { provider: AccountLinkProvider; label: string }): string | null {
  const direct = PROVIDER_LOGO_SRC[input.provider]
  if (typeof direct === 'string' && direct.trim().length > 0) return direct
  const label = input.label.trim().toLowerCase()
  if (label.includes('farcaster')) return '/brands/farcaster-logo.svg'
  return null
}

function resolveProviderBackgroundTint(input: { provider: AccountLinkProvider; label: string }): string {
  if (input.provider === 'zora_cross_app') {
    return 'bg-[radial-gradient(120%_120%_at_100%_0%,rgba(138,99,210,0.2),transparent_62%)]'
  }
  if (input.provider === 'twitter') {
    return 'bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.14),transparent_62%)]'
  }
  if (input.provider === 'telegram') {
    return 'bg-[radial-gradient(120%_120%_at_100%_0%,rgba(34,158,217,0.22),transparent_62%)]'
  }
  const label = input.label.trim().toLowerCase()
  if (label.includes('farcaster')) {
    return 'bg-[radial-gradient(120%_120%_at_100%_0%,rgba(138,99,210,0.2),transparent_62%)]'
  }
  return 'bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.1),transparent_62%)]'
}

function ProviderIconBadge({ provider, label }: { provider: AccountLinkProvider; label: string }) {
  const logoSrc = resolveProviderLogoSrc({ provider, label })
  const Icon = PROVIDER_ICON[provider]
  const commonClass =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-zinc-400'
  if (logoSrc) {
    return (
      <span className={commonClass} aria-hidden="true">
        <img src={logoSrc} alt="" className="h-3.5 w-3.5 object-contain" loading="lazy" />
      </span>
    )
  }
  if (Icon) {
    return (
      <span className={commonClass} aria-hidden="true">
        <Icon className="h-3 w-3" strokeWidth={1.75} />
      </span>
    )
  }
  const letter = provider === 'google' ? 'G' : provider.charAt(0).toUpperCase()
  return (
    <span className={`${commonClass} font-semibold text-[10px] text-zinc-300`} aria-hidden="true">
      {letter}
    </span>
  )
}

type Controller = ReturnType<typeof useAccountSetupController>

export function LinkedIdentitiesSection({
  controller,
  showPoints = true,
}: {
  controller: Controller
  showPoints?: boolean
}) {
  const { busyProvider, providerCards, onLinkProvider, onUnlinkProvider, telegramLaunchParamsAvailable } =
    controller

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Linked identities</div>
          <p className="mt-1 text-xs text-zinc-500">
            Connect channels for recovery, waitlist points, and cross-app login.
          </p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
          {providerCards.filter((p) => p.linked).length}/{providerCards.length}
        </span>
      </div>
      <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-white/[0.02]">
        {providerCards.map((provider) => {
          const busy = busyProvider === provider.provider
          const telegramBlocked =
            provider.provider === 'telegram' && !provider.linked && !telegramLaunchParamsAvailable
          const points = PROVIDER_POINTS[provider.provider] ?? null
          const logoSrc = resolveProviderLogoSrc({ provider: provider.provider, label: provider.label })
          const backgroundTintClass = resolveProviderBackgroundTint({
            provider: provider.provider,
            label: provider.label,
          })
          return (
            <li
              key={provider.provider}
              className="relative flex items-center gap-2.5 overflow-hidden bg-white/[0.01] px-3 py-2.5 text-[11.5px]"
            >
              <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${backgroundTintClass}`} />
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt=""
                  className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 select-none object-contain opacity-[0.1] saturate-0 brightness-200"
                  loading="lazy"
                  draggable={false}
                />
              ) : null}
              <ProviderIconBadge provider={provider.provider} label={provider.label} />
              <div className="relative z-10 min-w-0 flex-1">
                <div className="truncate text-zinc-200">{provider.label}</div>
                <div
                  className={`truncate text-[10.5px] ${
                    provider.linked ? 'text-emerald-400/80' : 'text-zinc-600'
                  }`}
                >
                  {provider.linked
                    ? provider.values.length > 0
                      ? provider.values.map((value) => shortValue(value)).join(', ')
                      : 'Linked'
                    : telegramBlocked
                      ? 'Open from Telegram'
                      : 'Not linked'}
                </div>
              </div>
              {showPoints && points !== null && !provider.linked ? (
                <span className="relative z-10 shrink-0 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
                  +{points}
                </span>
              ) : null}
              {provider.linked ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onUnlinkProvider(provider.provider)}
                  className="relative z-10 shrink-0 text-[10.5px] text-zinc-600 transition-colors hover:text-rose-300 disabled:opacity-50"
                >
                  {busy ? 'Signing out…' : `Sign out of ${provider.label}`}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || telegramBlocked}
                  onClick={() => void onLinkProvider(provider.provider)}
                  className="relative z-10 shrink-0 rounded-md border border-brand-primary/25 bg-brand-primary/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-brand-200 transition-colors hover:border-brand-primary/40 hover:bg-brand-primary/[0.14] disabled:opacity-40"
                >
                  {busy ? '…' : 'Link'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
