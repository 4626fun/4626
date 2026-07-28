import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Coins, Vault } from 'lucide-react'
import { getAddress, isAddress } from 'viem'

import { LaunchCoinCard } from '@/features/waitlist/LaunchCoinCard'
import { PageMeta } from '@/components/seo/PageMeta'
import {
  buildDeployVaultFromCoinPath,
  formatZoraPlatformReferrerLabel,
  getZoraPlatformReferrerAddress,
} from '@/lib/zora/referrals'
import { useAccountContext } from '@/wallet/accountContext'

type LaunchResult = {
  coinAddress: string
  symbol: string
  txHash: string | null
}

function shortAddress(value: string): string {
  if (!isAddress(value)) return value
  const normalized = getAddress(value)
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`
}

function FlowTabs({ active }: { active: 'coin' | 'vault' }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1 text-[11px]">
      <span
        className={
          active === 'coin'
            ? 'rounded-lg bg-white/12 px-3 py-1 text-white'
            : 'rounded-lg px-3 py-1 text-zinc-400'
        }
      >
        Coin
      </span>
      <Link
        className={
          active === 'vault'
            ? 'rounded-lg bg-white/12 px-3 py-1 text-white'
            : 'rounded-lg px-3 py-1 text-zinc-400 hover:text-white'
        }
        to="/deploy/vault"
      >
        Vault
      </Link>
    </div>
  )
}

function StepRail({ complete }: { complete: boolean }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[11px]">
      <li className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white">
        <span className="font-mono text-zinc-500">01</span>
        Launch coin
      </li>
      <li aria-hidden className="text-zinc-700">
        →
      </li>
      <li
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
          complete
            ? 'border-brand-primary/30 bg-brand-primary/10 text-white'
            : 'border-white/10 bg-transparent text-zinc-500'
        }`}
      >
        <span className="font-mono text-zinc-500">02</span>
        Deploy vault
      </li>
    </ol>
  )
}

function OwnershipStrip(props: {
  creatorAddress: string | null
  signerAddress: string | null
  platformReferrer: string
}) {
  const rows = [
    {
      label: 'Creator / payout',
      value: props.creatorAddress ? shortAddress(props.creatorAddress) : 'Sign in to load your CSW',
      hint: 'Your Coinbase Smart Wallet owns the coin and receives creator rewards',
      ready: Boolean(props.creatorAddress),
    },
    {
      label: 'Signer',
      value: props.signerAddress ? shortAddress(props.signerAddress) : 'Waiting for owner signer',
      hint: 'Embedded owner signs the gas-sponsored UserOp',
      ready: Boolean(props.signerAddress),
    },
    {
      label: 'Platform referrer',
      value: formatZoraPlatformReferrerLabel(getAddress(props.platformReferrer)),
      hint: '4626 earns Zora platform referral rewards on future trades',
      ready: true,
    },
  ] as const

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            {row.label}
          </div>
          <div
            className={`mt-1.5 font-mono text-[13px] ${row.ready ? 'text-white' : 'text-zinc-500'}`}
          >
            {row.value}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-zinc-600">{row.hint}</p>
        </div>
      ))}
    </div>
  )
}

function LaunchSuccess(props: LaunchResult) {
  const vaultPath = useMemo(
    () => buildDeployVaultFromCoinPath(props.coinAddress),
    [props.coinAddress],
  )

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold text-emerald-200">Creator coin is live</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
            <span className="font-mono text-zinc-300">${props.symbol}</span> launched through 4626
            with platform referrer set. Next: wrap it in a vault.
          </p>
        </div>
      </div>

      <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
          <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Coin</dt>
          <dd className="mt-1">
            <a
              href={`https://zora.co/coin/base:${props.coinAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-brand-primary hover:text-brand-accent"
            >
              {shortAddress(props.coinAddress)}
            </a>
          </dd>
        </div>
        {props.txHash ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Transaction</dt>
            <dd className="mt-1">
              <a
                href={`https://basescan.org/tx/${props.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-brand-primary hover:text-brand-accent"
              >
                {props.txHash.slice(0, 10)}…
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Link
          to={vaultPath}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          <Vault className="h-4 w-4" aria-hidden />
          Deploy vault for ${props.symbol}
        </Link>
        <a
          href={`https://zora.co/coin/base:${props.coinAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-[13px] font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
        >
          View on Zora
        </a>
      </div>
    </div>
  )
}

export function DeployCoin() {
  const accountContext = useAccountContext()
  const canonicalSmartWalletAddress = accountContext.cswAddress ?? null
  const ownerSignerAddress = accountContext.signerAddress ?? null
  const platformReferrer = getZoraPlatformReferrerAddress()
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null)

  const handleCoinCreated = useCallback(
    (coinAddress: string, symbol: string, txHash?: string | null) => {
      setLaunchResult({
        coinAddress: getAddress(coinAddress),
        symbol,
        txHash: txHash ?? null,
      })
    },
    [],
  )

  return (
    <div className="vault-shell relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(120%_100%_at_50%_0%,rgba(37,99,235,0.12),rgba(37,99,235,0.03)_45%,transparent_70%)]"
      />
      <PageMeta
        title="Launch Creator Coin"
        description="Launch your Zora Creator Coin on Base through 4626 with gas-sponsored creation and platform referral rewards, then continue to vault deploy."
        canonicalPath="/deploy/coin"
      />

      <section className="cinematic-section">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 space-y-3">
                <span className="label">Deploy</span>
                <h1 className="headline text-4xl sm:text-6xl">Launch Coin</h1>
                <p className="max-w-2xl text-sm font-light text-zinc-500">
                  Create your Zora Creator Coin through 4626 so platform referral rewards accrue to
                  the protocol — then continue to your ERC-4626 vault.
                </p>
                <FlowTabs active="coin" />
                <StepRail complete={Boolean(launchResult)} />
              </div>
              <div className="vault-pill normal-case tracking-[0.02em] gap-2 px-3 py-1">
                <img
                  src="/protocols/base.png"
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-3.5 w-3.5 opacity-90"
                />
                Base
              </div>
            </div>

            <OwnershipStrip
              creatorAddress={canonicalSmartWalletAddress}
              signerAddress={ownerSignerAddress}
              platformReferrer={platformReferrer}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
              <div className="space-y-4">
                {launchResult ? (
                  <LaunchSuccess {...launchResult} />
                ) : (
                  <LaunchCoinCard
                    smartWalletAddress={canonicalSmartWalletAddress}
                    ownerAddress={ownerSignerAddress}
                    onCoinCreated={handleCoinCreated}
                    hideSuccess
                  />
                )}
              </div>

              <aside className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                    <Coins className="h-4 w-4 text-brand-primary" aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-[14px] font-semibold text-white">Why launch here</h2>
                    <p className="text-[11px] text-zinc-500">Same Zora coin — 4626 as platform referrer</p>
                  </div>
                </div>
                <ul className="space-y-3 text-[13px] leading-relaxed text-zinc-400">
                  <li>
                    <span className="text-zinc-200">Platform referrer locked in</span>
                    <span className="mt-0.5 block text-[12px] text-zinc-600">
                      Every launch sets platform referrer to {formatZoraPlatformReferrerLabel(platformReferrer)} so
                      4626 earns Zora platform rewards on future volume.
                    </span>
                  </li>
                  <li>
                    <span className="text-zinc-200">Creator payout stays yours</span>
                    <span className="mt-0.5 block text-[12px] text-zinc-600">
                      Payout recipient is your CSW. Referral rewards are a separate protocol lane.
                    </span>
                  </li>
                  <li>
                    <span className="text-zinc-200">Vault is the next step</span>
                    <span className="mt-0.5 block text-[12px] text-zinc-600">
                      After launch we deep-link into Deploy Vault with your coin address prefilled.
                    </span>
                  </li>
                </ul>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
