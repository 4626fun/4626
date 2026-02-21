import { motion } from 'framer-motion'
import type { WalletMode } from '@/lib/uniswap/walletMode'
import { shortAddress } from '@/lib/uniswap/swapUtils'

const LABELS: Record<WalletMode, string> = {
  canonical: 'Smart Wallet',
  eoa: 'Connected',
}

export function WalletModeToggle(props: {
  mode: WalletMode
  preferredMode: WalletMode
  executionAddress: `0x${string}` | null
  busy: boolean
  canonicalAvailable: boolean
  eoaAvailable: boolean
  fallbackActive: boolean
  onChange: (mode: WalletMode) => void
  onEnableCanonical: () => void
  /** Compact mode hides address and extra copy — used in ExecutionBar */
  compact?: boolean
}) {
  const modes: WalletMode[] = ['canonical', 'eoa']

  return (
    <div className={props.compact ? 'flex items-center gap-2' : 'space-y-2'}>
      {/* Segmented pill toggle */}
      <div className="inline-flex rounded-full border border-white/12 bg-black/40 p-0.5 text-xs">
        {modes.map((m) => {
          const available = m === 'canonical' ? props.canonicalAvailable : props.eoaAvailable
          const active = props.mode === m
          return (
            <motion.button
              key={m}
              type="button"
              onClick={() => {
                // If CSW isn't set up yet, clicking it navigates to setup instead of
                // silently failing with a disabled-button NOP.
                if (!available && m === 'canonical') {
                  props.onEnableCanonical?.()
                  return
                }
                if (!available) return
                props.onChange(m)
              }}
              disabled={props.busy}
              whileTap={{ scale: 0.96 }}
              className={`relative min-h-7 rounded-full px-3 py-1 transition-colors disabled:opacity-40 ${
                active
                  ? 'bg-white/15 text-white font-medium'
                  : available
                    ? 'text-zinc-500 hover:text-zinc-300'
                    : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {LABELS[m]}
              {m === 'canonical' && !props.canonicalAvailable && (
                <span className="ml-1 inline-block rounded-full bg-amber-500/20 px-1 py-px text-[9px] text-amber-300">
                  Set up
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Execution address + status — hidden in compact mode */}
      {!props.compact && (
        <div className="flex flex-wrap items-center gap-1.5">
          {props.executionAddress && (
            <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
              {shortAddress(props.executionAddress)}
            </span>
          )}
          {props.fallbackActive && (
            <span className="rounded-full border border-amber-400/25 bg-amber-500/8 px-2 py-0.5 text-[10px] text-amber-300">
              Fallback active
            </span>
          )}
          {props.mode === 'eoa' && !props.fallbackActive && (
            <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] text-zinc-500">
              Standard mode
            </span>
          )}
        </div>
      )}

      {/* Enable CSW CTA (shown when preferred=canonical but unavailable) */}
      {!props.compact && props.preferredMode === 'canonical' && !props.canonicalAvailable && (
        <motion.button
          type="button"
          onClick={props.onEnableCanonical}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs text-brand-300 transition hover:bg-brand-primary/20"
        >
          Set up Smart Wallet →
        </motion.button>
      )}
    </div>
  )
}
