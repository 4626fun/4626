import { getAddress, isAddress, type Address } from 'viem'

export type ActivationServerWallet = {
  walletId: string
  address: Address
}

function isMissingPrivyWalletError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /privy_http_404\b|wallet[_ ]?not[_ ]?found|not found/i.test(message)
}

export function activationServerWalletIdempotencyKey(
  profileId: number,
  parentCswAddress: Address,
): string {
  return `enable-4626:${profileId}:${parentCswAddress.toLowerCase()}`
}

export async function resolveActivationServerWallet(params: {
  profileId: number
  parentCswAddress: Address
  persistedWalletId: string | null
  persistedWalletAddress: string | null
  fetchWallet: (walletId: string) => Promise<{ walletId: string; address: string }>
  createWallet: (idempotencyKey: string) => Promise<{ walletId: string; address: string }>
}): Promise<ActivationServerWallet> {
  const idempotencyKey = activationServerWalletIdempotencyKey(
    params.profileId,
    params.parentCswAddress,
  )

  let wallet: { walletId: string; address: string }
  if (params.persistedWalletId) {
    try {
      wallet = await params.fetchWallet(params.persistedWalletId)
    } catch (error) {
      // Deleted/orphaned Privy wallet IDs should not permanently block activation.
      // Recreate with the same profile+CSW idempotency key; address mismatch on a
      // successful fetch still fails closed below.
      if (!isMissingPrivyWalletError(error)) throw error
      wallet = await params.createWallet(idempotencyKey)
    }
  } else {
    wallet = await params.createWallet(idempotencyKey)
  }

  if (!isAddress(wallet.address)) throw new Error('server_wallet_address_invalid')
  const address = getAddress(wallet.address)
  if (
    params.persistedWalletId &&
    params.persistedWalletId === wallet.walletId &&
    params.persistedWalletAddress &&
    (!isAddress(params.persistedWalletAddress) ||
      getAddress(params.persistedWalletAddress) !== address)
  ) {
    throw new Error('persisted_server_wallet_binding_mismatch')
  }
  return {
    walletId: wallet.walletId,
    address,
  }
}
