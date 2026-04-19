import Jazzicon, { jsNumberForAddress } from 'react-jazzicon'
import type { Address } from 'viem'

/**
 * Deterministic jazzicon avatar derived from an Ethereum address.
 *
 * Uses `react-jazzicon` under the hood — the same library MetaMask uses
 * internally. Same address always produces the same icon across the
 * app so users learn to recognize their own address by the icon alone.
 *
 * Size matches the surrounding avatar slot. Default 24px for the
 * header card; `size={48}` on the `/accounts` hero.
 */
export function JazziconAvatar({
  address,
  size = 24,
  className,
}: {
  address: Address | string | null | undefined
  size?: number
  className?: string
}) {
  if (!address) {
    return (
      <div
        aria-hidden
        className={`rounded-full bg-white/5 ${className ?? ''}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      aria-hidden
      className={`rounded-full overflow-hidden flex-shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <Jazzicon diameter={size} seed={jsNumberForAddress(String(address))} />
    </div>
  )
}
