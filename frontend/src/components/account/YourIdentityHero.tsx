import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

import { useCanonicalIdentity } from '@/hooks/useCanonicalIdentity'
import { useBasenameForAddress } from '@/hooks/useBasenameForAddress'
import { useCreatorCoinBadge } from '@/hooks/useCreatorCoinBadge'
import { JazziconAvatar } from '@/components/account/JazziconAvatar'
import { CopyableAddress } from '@/components/account/CopyableAddress'

/**
 * `/accounts` page hero — the primary "this is who you are onchain"
 * surface. Shows:
 *
 *   - 48×48 avatar (basename/ENS → jazzicon fallback)
 *   - CSW basename/ENS (or short address if no name resolves)
 *   - "Coinbase Smart Wallet · Base" labeled subtitle
 *   - Copyable full CSW address
 *   - Creator coin chip with logo, symbol, name, and external links
 *     to Zora + 4626 explore (only when the coin resolves)
 *
 * Uses the same hooks as the nav header card so queries are shared via
 * react-query / the basename cache.
 */
export function YourIdentityHero() {
  const identity = useCanonicalIdentity()
  const cswBasename = useBasenameForAddress(identity.cswAddress)
  const coinBadge = useCreatorCoinBadge(identity.creatorCoinAddress)

  if (!identity.cswAddress) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
          Your canonical identity
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          Sign in to see your Coinbase Smart Wallet address + creator coin.
        </p>
      </section>
    )
  }

  const primaryLabel = cswBasename.displayName ?? formatShort(identity.cswAddress)

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
        Your canonical identity
      </div>

      <div className="mt-4 flex items-start gap-4">
        {cswBasename.avatar ? (
          <img
            src={cswBasename.avatar}
            alt=""
            width={48}
            height={48}
            className="rounded-full flex-shrink-0 object-cover"
            style={{ width: 48, height: 48 }}
          />
        ) : (
          <JazziconAvatar address={identity.cswAddress} size={48} />
        )}

        <div className="min-w-0 flex-1">
          <div className="text-lg font-medium text-white truncate">{primaryLabel}</div>
          <div className="mt-0.5 text-xs text-zinc-500">Coinbase Smart Wallet · Base</div>
          <div className="mt-2">
            <CopyableAddress address={identity.cswAddress} />
          </div>
        </div>
      </div>

      {/* Creator coin chip — only when the coin resolves */}
      {coinBadge && coinBadge.symbol ? (
        <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">
            Your creator coin
          </div>
          <div className="mt-2 flex items-center gap-3">
            {coinBadge.logoUrl ? (
              <img
                src={coinBadge.logoUrl}
                alt=""
                width={32}
                height={32}
                className="rounded-md flex-shrink-0"
                style={{ width: 32, height: 32 }}
              />
            ) : (
              <div
                className="rounded-md bg-white/5 flex items-center justify-center text-xs text-zinc-400"
                style={{ width: 32, height: 32 }}
              >
                ${coinBadge.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white">
                <span className="text-brand-accent">${coinBadge.symbol}</span>
                {coinBadge.name ? (
                  <span className="ml-2 text-zinc-400">{coinBadge.name}</span>
                ) : null}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
                <CopyableAddress address={coinBadge.address} variant="muted" />
                {coinBadge.priceUsd ? (
                  <span>
                    ${Number(coinBadge.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </span>
                ) : null}
                {coinBadge.marketCapUsd ? (
                  <span>
                    {compactUsd(coinBadge.marketCapUsd)} mcap
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <a
              href={`https://zora.co/coin/base:${coinBadge.address}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 underline decoration-dotted"
            >
              View on Zora <ExternalLink className="h-3 w-3" />
            </a>
            <Link
              to={`/explore/creators/base/${coinBadge.address}`}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 underline decoration-dotted"
            >
              View on 4626 <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/**
 * `/accounts` two-column "Signers" section.
 *
 * Left: active external EOA (Rabby / MetaMask / CBW) — with CTA when
 * none is connected. Right: Privy embedded EOA (auto-provisioned).
 *
 * "co-owner of CSW" subtitle is intentionally NOT set for the external
 * EOA here — we'd need to call `CoinbaseSmartWallet.isOwner(eoa)` to
 * confirm and render that copy conditionally. Follow-up.
 */
export function SignersSection({
  onConnectExternal,
}: {
  onConnectExternal?: () => void
}) {
  const identity = useCanonicalIdentity()
  const externalBasename = useBasenameForAddress(identity.externalEoaAddress)
  const embeddedBasename = useBasenameForAddress(identity.privyEmbeddedAddress)

  return (
    <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* External signer */}
      {identity.externalEoaAddress ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Active external signer
          </div>
          <div className="mt-3 flex items-center gap-3">
            {externalBasename.avatar ? (
              <img
                src={externalBasename.avatar}
                alt=""
                width={36}
                height={36}
                className="rounded-full flex-shrink-0 object-cover"
                style={{ width: 36, height: 36 }}
              />
            ) : (
              <JazziconAvatar address={identity.externalEoaAddress} size={36} />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white truncate">
                {externalBasename.displayName ?? formatShort(identity.externalEoaAddress)}
              </div>
              <div className="text-[11px] text-zinc-500">External wallet — signs on behalf of CSW</div>
            </div>
          </div>
          <div className="mt-2">
            <CopyableAddress address={identity.externalEoaAddress} variant="muted" />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onConnectExternal}
          className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-left hover:bg-white/[0.04] hover:border-white/20 transition-colors"
        >
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Connect an external signer
          </div>
          <div className="mt-2 text-sm text-zinc-300">
            Add Rabby, MetaMask, or Coinbase Wallet
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Optional — use an external wallet as a secondary signer on your CSW.
          </div>
        </button>
      )}

      {/* Embedded (Privy) signer */}
      {identity.privyEmbeddedAddress ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Privy embedded (auto)
          </div>
          <div className="mt-3 flex items-center gap-3">
            {embeddedBasename.avatar ? (
              <img
                src={embeddedBasename.avatar}
                alt=""
                width={36}
                height={36}
                className="rounded-full flex-shrink-0 object-cover"
                style={{ width: 36, height: 36 }}
              />
            ) : (
              <JazziconAvatar address={identity.privyEmbeddedAddress} size={36} />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white truncate">
                {embeddedBasename.displayName ?? formatShort(identity.privyEmbeddedAddress)}
              </div>
              <div className="text-[11px] text-zinc-500">
                {identity.activeSigner === 'embedded'
                  ? 'Default signer — Privy-managed'
                  : 'Idle — Privy-managed, available as fallback'}
              </div>
            </div>
          </div>
          <div className="mt-2">
            <CopyableAddress address={identity.privyEmbeddedAddress} variant="muted" />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 text-sm text-zinc-500">
          No Privy embedded wallet available.
        </div>
      )}
    </section>
  )
}

/**
 * Advanced / developer-mode disclosure wrapper for everything that
 * used to live at the top of `/accounts`. Keeps the page scannable
 * by default; click the summary to expand.
 */
export function AdvancedDisclosure({
  title = 'Advanced',
  summary = 'Detailed Privy wallet list, provider linking, Arch B controls, session tooling.',
  defaultOpen = false,
  children,
}: {
  title?: string
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] open:bg-white/[0.03] transition-colors"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between select-none">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">{title}</div>
          <div className="mt-0.5 text-xs text-zinc-400">{summary}</div>
        </div>
        <span className="text-xs text-zinc-500 group-open:hidden">Expand ▾</span>
      </summary>
      <div className="px-5 pb-5 pt-0 border-t border-white/5">{children}</div>
    </details>
  )
}

function formatShort(value: string | null | undefined): string {
  if (!value) return ''
  if (value.length <= 10) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function compactUsd(raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return `$${raw}`
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}
