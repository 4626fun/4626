import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { isAddress, type Address } from 'viem'
import { useAccount } from 'wagmi'

import {
  AKITA,
  getAkitaCcaLaunchArmForChain,
  getAkitaChainStack,
  isAkitaExpansionChain,
} from '@/config/contracts'
import { DEFAULT_CHAIN_ID, getChainMeta } from '@/config/chains'
import { META, PageMeta } from '@/components/seo/PageMeta'
import { CcaAuctionPanel } from '@/components/cca/CcaAuctionPanel'
import { toShareSymbol } from '@/lib/tokens/tokenSymbols'

function resolveCcaStrategyFromRouteParam(
  addr: string | undefined,
  chainId: number | null | undefined,
): Address | undefined {
  // Preserve backwards compatibility with older links that passed
  // vault/wrapper/shareOFT into `/auction/bid/:address`.
  const pinnedArm = getAkitaCcaLaunchArmForChain(chainId)
  const stack = getAkitaChainStack(chainId)
  const fallback = pinnedArm

  if (!addr) return fallback
  if (!isAddress(addr)) return fallback

  const lower = addr.toLowerCase()
  const knownAliases = [stack.ccaLaunchArm, stack.vault, stack.wrapper, stack.shareOFT]
    .filter((value): value is `0x${string}` => !!value)
    .map((value) => value.toLowerCase())

  // On Base, also remap the live AKITA aliases (covers env-overridden stacks).
  if (!isAkitaExpansionChain(chainId)) {
    knownAliases.push(
      String(AKITA.ccaLaunchArm).toLowerCase(),
      String(AKITA.vault).toLowerCase(),
      String(AKITA.wrapper).toLowerCase(),
      String(AKITA.shareOFT).toLowerCase(),
    )
  }

  if (knownAliases.includes(lower)) return (pinnedArm ?? AKITA.ccaLaunchArm) as Address

  // Otherwise, treat the route param as the CCALaunchArm address.
  return addr as Address
}

export function AuctionBid() {
  const SHARE_SYMBOL = toShareSymbol('AKITA')
  const { address } = useParams()
  const { chainId: walletChainId } = useAccount()
  const chainId = walletChainId ?? DEFAULT_CHAIN_ID
  const chainMeta = getChainMeta(chainId)
  const stack = getAkitaChainStack(walletChainId)
  const ccaLaunchArm = resolveCcaStrategyFromRouteParam(address, walletChainId)
  const vaultAddress = (stack.vault ?? (!isAkitaExpansionChain(walletChainId) ? AKITA.vault : undefined)) as
    | Address
    | undefined
  const expansionMissingPin = isAkitaExpansionChain(walletChainId) && !ccaLaunchArm

  if (expansionMissingPin || !ccaLaunchArm) {
    return (
      <div className="relative min-h-0 w-full bg-transparent">
        <PageMeta
          title={META.auctionBid.title}
          description={META.auctionBid.description}
          canonicalPath={`/auction/${address ?? ''}`}
        />
        <section className="cinematic-section">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
              <h1 className="font-display text-2xl font-bold mb-2">CCA stack not pinned</h1>
              <p className="text-zinc-400 text-sm">
                No ■AKITA CCA arm is configured for {chainMeta?.name ?? `chain ${chainId}`}.
                Expansion chains never reuse the Base stack. Deploy and pin{' '}
                <code className="text-xs">VITE_AKITA_CCA_STRATEGY_*</code> before bidding here.
              </p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="relative min-h-0 w-full bg-transparent">
      <PageMeta title={META.auctionBid.title} description={META.auctionBid.description} canonicalPath={`/auction/${address ?? ''}`} />
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {vaultAddress ? (
            <Link
              to={`/vault/${vaultAddress}`}
              className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-400 transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="label">Back to vault</span>
            </Link>
          ) : (
            <div className="mb-8 text-sm text-zinc-500">Vault pin not set for this chain.</div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <CcaAuctionPanel
              ccaLaunchArm={ccaLaunchArm}
              wsSymbol={SHARE_SYMBOL}
              vaultAddress={vaultAddress}
            />
          </motion.div>
        </div>
      </section>
    </div>
  )
}
