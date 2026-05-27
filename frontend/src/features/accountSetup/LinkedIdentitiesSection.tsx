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

function ProviderIconBadge({ provider }: { provider: AccountLinkProvider }) {
  const Icon = PROVIDER_ICON[provider]
  const commonClass =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-zinc-400'
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
          return (
            <li key={provider.provider} className="flex items-center gap-2.5 px-3 py-2.5 text-[11.5px]">
              <ProviderIconBadge provider={provider.provider} />
              <div className="min-w-0 flex-1">
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
                <span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
                  +{points}
                </span>
              ) : null}
              {provider.linked ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onUnlinkProvider(provider.provider)}
                  className="shrink-0 text-[10.5px] text-zinc-600 transition-colors hover:text-rose-300 disabled:opacity-50"
                >
                  {busy ? '…' : 'Unlink'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || telegramBlocked}
                  onClick={() => void onLinkProvider(provider.provider)}
                  className="shrink-0 rounded-md border border-brand-primary/25 bg-brand-primary/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-brand-200 transition-colors hover:border-brand-primary/40 hover:bg-brand-primary/[0.14] disabled:opacity-40"
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
