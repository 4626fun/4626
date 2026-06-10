import type { ReactNode } from 'react'

import { NetworkBadge } from './ui/NetworkBadge'

const HERO_PILLS = ['Creator Coin', 'Vault', 'Base', 'ERC-4337 gas-free'] as const

/**
 * Calm hero header for the deploy cockpit: title, one-line purpose,
 * context pills, and the Base network badge. Children render under the
 * subtitle (tab switcher, signer nudges).
 */
export function DeployHero({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0 space-y-3">
        <span className="label">Deploy</span>
        <h1 className="headline text-4xl sm:text-6xl">Deploy Vault</h1>
        <p className="text-sm font-light text-zinc-500">
          Deploy a deterministic Creator Vault on Base. Only the creator or current payout recipient can deploy.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {HERO_PILLS.map((pill) => (
            <span
              key={pill}
              className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500"
            >
              {pill}
            </span>
          ))}
        </div>
        {children}
      </div>
      <NetworkBadge className="mt-1" />
    </div>
  )
}
