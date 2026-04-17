import { memo, useCallback, useMemo, useState } from 'react'
import { Select } from '@coinbase/cds-web/alpha/select'
import type { SelectOption } from '@coinbase/cds-web/alpha/select'
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
  const options = useMemo(
    () =>
      SUPPORTED_CHAINS.map((chain) => {
        const isWalletChain = chain.id === walletChainId
        const option: SelectOption<string> & { media?: React.ReactElement } = {
          value: String(chain.id),
          label: chain.name,
          description: isWalletChain && chain.id !== selectedChainId ? 'Wallet connected' : undefined,
          media: <ChainLogo src={chain.logoUrl} name={chain.name} size={compact ? 16 : 20} />,
        }
        return option
      }),
    [walletChainId, selectedChainId, compact],
  )

  const handleChange = useCallback(
    (value: string | null) => {
      if (value != null) {
        onSelect(Number(value) as SupportedChainId)
      }
    },
    [onSelect],
  )

  return (
    <Select
      value={String(selectedChainId)}
      onChange={handleChange}
      options={options}
      compact={compact}
      accessibilityLabel="Select network"
      bordered={false}
    />
  )
})
