import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search, X } from 'lucide-react'
import type { TokenDisplay, TokenOption } from '@/lib/uniswap/swapUtils'

function TokenAvatar(props: { symbol: string; logoUrl?: string | null; logoUrls?: string[] }) {
  const candidates = [
    props.logoUrl,
    ...(props.logoUrls ?? []),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const uniqueCandidates = Array.from(new Set(candidates))
  const [idx, setIdx] = useState(0)
  const current = uniqueCandidates[idx] ?? null

  if (current) {
    return (
      <img
        src={current}
        alt={props.symbol}
        className="h-8 w-8 rounded-full object-cover border border-white/10 bg-black/30 shrink-0"
        loading="lazy"
        onError={() => setIdx((prev) => prev + 1)}
      />
    )
  }
  return (
    <div className="h-8 w-8 rounded-full border border-white/10 bg-zinc-800 text-[11px] font-semibold text-zinc-100 flex items-center justify-center shrink-0">
      {props.symbol.slice(0, 2).toUpperCase()}
    </div>
  )
}

export function TokenSelectorPill(props: {
  display: TokenDisplay
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      whileTap={{ scale: 0.96 }}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/14 bg-[#1a2230] px-2.5 py-1.5 text-sm font-semibold text-white transition hover:bg-[#212c3e] disabled:opacity-60 shrink-0"
    >
      <TokenAvatar symbol={props.display.symbol} logoUrl={props.display.logoUrl} logoUrls={props.display.logoUrls} />
      <span>{props.display.symbol}</span>
      <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
    </motion.button>
  )
}

export function TokenSelectorSheet(props: {
  open: boolean
  tokenOptions: TokenOption[]
  selectedToken: string
  onSelect: (address: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')

  const filtered = props.tokenOptions.filter((opt) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      opt.symbol.toLowerCase().includes(q) ||
      opt.name.toLowerCase().includes(q) ||
      opt.address.toLowerCase().includes(q)
    )
  })

  const coreTokens = filtered.filter((o) => o.group === 'core')
  const ecosystemTokens = filtered.filter((o) => o.group !== 'core')

  function handleSelect(address: string) {
    props.onSelect(address)
    setQuery('')
    props.onClose()
  }

  return (
    <AnimatePresence>
      {props.open && (
        <div className="fixed inset-0 z-100">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setQuery(''); props.onClose() }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0e1219] shadow-[0_-30px_80px_-20px_rgba(0,0,0,0.9)] pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            {/* Handle */}
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/15" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <span className="text-sm font-semibold text-white">Select token</span>
              <button
                type="button"
                onClick={() => { setQuery(''); props.onClose() }}
                className="rounded-full border border-white/10 p-1.5 text-zinc-400 hover:text-white transition"
                aria-label="Close token selector"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, symbol, or address"
                  className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery('')} className="text-zinc-500 hover:text-zinc-300">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Token list */}
            <div className="max-h-72 overflow-y-auto px-3 pb-2">
              {coreTokens.length > 0 && (
                <>
                  <div className="px-2 pb-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-600">Core tokens</div>
                  {coreTokens.map((opt) => (
                    <TokenRow
                      key={opt.address}
                      option={opt}
                      selected={opt.address.toLowerCase() === props.selectedToken.toLowerCase()}
                      onSelect={handleSelect}
                    />
                  ))}
                </>
              )}
              {ecosystemTokens.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-600">Creator ecosystem</div>
                  {ecosystemTokens.map((opt) => (
                    <TokenRow
                      key={opt.address}
                      option={opt}
                      selected={opt.address.toLowerCase() === props.selectedToken.toLowerCase()}
                      onSelect={handleSelect}
                    />
                  ))}
                </>
              )}
              {filtered.length === 0 && (
                <div className="py-6 text-center text-sm text-zinc-500">No tokens found</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function TokenRow(props: { option: TokenOption; selected: boolean; onSelect: (address: string) => void }) {
  const { option } = props
  return (
    <motion.button
      type="button"
      onClick={() => props.onSelect(option.address)}
      whileTap={{ scale: 0.98 }}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        props.selected
          ? 'border-brand-primary/40 bg-brand-primary/15 text-white'
          : 'border-transparent text-zinc-200 hover:border-white/8 hover:bg-white/6'
      }`}
    >
      <TokenAvatar symbol={option.symbol} logoUrl={option.logoUrl} logoUrls={option.logoUrls} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight truncate">{option.symbol}</div>
        <div className="text-[11px] text-zinc-500 truncate">{option.name}</div>
      </div>
      {props.selected && (
        <div className="h-2 w-2 rounded-full bg-brand-primary shrink-0" />
      )}
    </motion.button>
  )
}
