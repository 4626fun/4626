type OwnerWalletConnectListInput = {
  prefersWalletConnectQr: boolean
}

/**
 * Keep MetaMask under Privy's detected-wallet bucket instead of a dedicated
 * `metamask` entry. The dedicated path is more likely to hang on some
 * extension stacks, while detected wallets still include MetaMask.
 */
export function buildOwnerWalletConnectList(input: OwnerWalletConnectListInput): string[] {
  return [
    'coinbase_wallet',
    'base_account',
    input.prefersWalletConnectQr ? 'wallet_connect_qr' : 'wallet_connect',
    'detected_ethereum_wallets',
  ]
}

const OWNER_WALLET_CONNECT_FALLBACK_ERROR =
  'Wallet connection stalled. Close stale wallet popups, keep one wallet extension enabled, then retry. You can also use Coinbase Wallet or WalletConnect.'

export function mapOwnerWalletConnectError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const trimmed = message.trim()
  if (!trimmed) return OWNER_WALLET_CONNECT_FALLBACK_ERROR

  const lower = trimmed.toLowerCase()
  if (
    lower.includes('owner wallet connect timed out') ||
    lower.includes('waiting for metamask') ||
    lower.includes('one wallet at a time')
  ) {
    return OWNER_WALLET_CONNECT_FALLBACK_ERROR
  }

  return trimmed
}
