import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SUPPORTED_CHAINS, type SupportedChainId } from '@/config/chains'

export interface ChainSelectorProps {
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
  const listboxId = useId()
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const selected = useMemo(
    () => SUPPORTED_CHAINS.find((c) => c.id === selectedChainId) ?? SUPPORTED_CHAINS[0] ?? null,
    [selectedChainId],
  )

  if (!selected) return null

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const el = wrapperRef.current
      if (!el) return
      if (el.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleSelect = useCallback(
    (chainId: SupportedChainId) => {
      onSelect(chainId)
      setOpen(false)
    },
    [onSelect],
  )

  const triggerSize = compact ? 16 : 20
  const optionSize = compact ? 18 : 22

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={`Select network, ${selected.name} selected`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-lg ${compact ? 'px-1.5 py-1' : 'px-2 py-1.5'} text-vault-text transition-colors hover:bg-[rgb(var(--vault-card-raised)/0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--vault-border-strong))]`}
      >
        <ChainLogo src={selected.logoUrl} name={selected.name} size={triggerSize} />
        <ChevronDown
          className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-vault-subtext transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Select network"
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[220px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-white/10 bg-black/90 p-1 shadow-xl backdrop-blur"
        >
          {SUPPORTED_CHAINS.map((chain) => {
            const isSelected = chain.id === selectedChainId
            const isWalletChain = chain.id === walletChainId
            return (
              <li key={chain.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(chain.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-[rgb(var(--vault-card-raised)/0.75)] text-vault-text'
                      : 'text-vault-text hover:bg-[rgb(var(--vault-card-raised)/0.55)]'
                  }`}
                >
                  <ChainLogo src={chain.logoUrl} name={chain.name} size={optionSize} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium leading-tight">{chain.name}</span>
                    {isWalletChain && !isSelected ? (
                      <span className="text-[10px] leading-tight text-vault-subtext">
                        Wallet connected
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})
