import type { WalletMode } from '@/lib/uniswap/walletMode'
import { shortAddress } from '@/lib/uniswap/swapUtils'

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
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Execution</div>
      <div className="mt-2 inline-flex rounded-full border border-white/15 bg-black/35 p-1 text-xs">
        <button
          type="button"
          onClick={() => props.onChange('canonical')}
          disabled={!props.canonicalAvailable || props.busy}
          className={`min-h-10 rounded-full px-3 transition disabled:opacity-50 ${
            props.mode === 'canonical' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Canonical CSW
        </button>
        <button
          type="button"
          onClick={() => props.onChange('eoa')}
          disabled={!props.eoaAvailable || props.busy}
          className={`min-h-10 rounded-full px-3 transition disabled:opacity-50 ${
            props.mode === 'eoa' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Connected EOA
        </button>
      </div>
      <div className="mt-2 text-xs text-zinc-400">
        Using {props.mode === 'canonical' ? 'Zora Coinbase Smart Wallet' : 'Connected EOA'}{' '}
        {props.executionAddress ? `(${shortAddress(props.executionAddress)})` : ''}
      </div>
      {props.fallbackActive ? (
        <div className="mt-1 text-[11px] text-amber-300">
          Preferred mode ({props.preferredMode === 'canonical' ? 'Canonical CSW' : 'Connected EOA'}) is unavailable.
        </div>
      ) : null}
      {props.preferredMode === 'canonical' && !props.canonicalAvailable ? (
        <button
          type="button"
          onClick={props.onEnableCanonical}
          className="mt-2 min-h-10 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-3 text-xs text-brand-100 hover:bg-brand-primary/20"
        >
          Enable CSW
        </button>
      ) : null}
    </div>
  )
}
