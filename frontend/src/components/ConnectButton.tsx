import { ConnectButtonWeb3 } from './ConnectButtonWeb3'

/**
 * Simple wrapper around ConnectButtonWeb3.
 * Web3 is available on route-scoped provider shells.
 */
export function ConnectButton({ variant }: { variant?: string }) {
  return <ConnectButtonWeb3 variant={variant === 'nav' ? 'nav' : 'default'} />
}
