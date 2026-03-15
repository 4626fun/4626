import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { SUPPORTED_CHAINS, type SupportedChainId } from '@/config/chains'

interface ChainSelectorProps {
  selectedChainId: SupportedChainId
  walletChainId?: number | null
  onSelect: (chainId: SupportedChainId) => void
  compact?: boolean
}

function ChainLogo({ src, name, size = 20 }: { src: string; name: string; size?: number }) {
  const [error, setError] = useState(false)
  const isBaseLogo = name.trim().toLowerCase() === 'base'
  const resolvedSrc = isBaseLogo ? '/base/base-square-blue.svg' : src
  const shapeClass = isBaseLogo ? 'rounded-[4px]' : 'rounded-full'
  const fitClass = isBaseLogo ? 'object-contain' : 'object-cover'
  if (error || !resolvedSrc) {
    return (
      <div
        className={`shrink-0 flex items-center justify-center bg-vault-cardRaised text-[9px] font-bold text-vault-text ${shapeClass}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {name.slice(0, 1)}
      </div>
    )
  }
  return (
    <img
      src={resolvedSrc}
      alt={name}
      className={`${shapeClass} ${fitClass} shrink-0`}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={() => setError(true)}
    />
  )
}

export const ChainSelector = memo(function ChainSelector({
  selectedChainId,
  walletChainId,
  onSelect,
  compact = false,
}: ChainSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const prefersReduced = useReducedMotion()
  const selected = SUPPORTED_CHAINS.find((c) => c.id === selectedChainId) ?? SUPPORTED_CHAINS[0]!

  const handleSelect = useCallback(
    (chainId: SupportedChainId) => {
      onSelect(chainId)
      setOpen(false)
    },
    [onSelect],
  )

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const mismatch = walletChainId != null && walletChainId !== selectedChainId

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Selected network: ${selected.name}`}
        className={`inline-flex items-center gap-1.5 rounded-xl transition ${
          mismatch
            ? 'bg-amber-500/8 hover:bg-amber-500/12'
            : 'bg-[rgb(var(--vault-card-raised)/0.72)] hover:bg-[rgb(var(--vault-card-raised)/0.9)]'
        } ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'}`}
      >
        <ChainLogo src={selected.logoUrl} name={selected.name} size={compact ? 16 : 20} />
        {!compact && <span className="text-vault-text font-medium">{selected.shortName}</span>}
        <ChevronDown className={`h-3 w-3 text-vault-subtext transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label="Select network"
            initial={prefersReduced ? false : { opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-2xl border border-[rgb(var(--vault-border-strong)/0.62)] bg-[rgb(var(--vault-card)/0.98)] p-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
          >
            {SUPPORTED_CHAINS.map((chain) => {
              const isSelected = chain.id === selectedChainId
              const isWalletChain = chain.id === walletChainId
              return (
                <button
                  key={chain.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(chain.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    isSelected
                      ? 'bg-brand-primary/12 text-vault-text'
                      : 'text-vault-subtext hover:bg-white/6 hover:text-vault-text'
                  }`}
                >
                  <ChainLogo src={chain.logoUrl} name={chain.name} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">{chain.name}</div>
                    {isWalletChain && !isSelected && (
                      <div className="text-[10px] text-emerald-400">Wallet connected</div>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-brand-primary shrink-0" />}
                </button>
              )
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
})
