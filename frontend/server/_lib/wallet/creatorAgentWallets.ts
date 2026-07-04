import {
  CreatorInfrastructureNotProvisionedError,
  CreatorInfrastructureMismatchError,
  resolveCreatorExecutionWallet,
} from './creatorInfrastructure.js'

export { CreatorInfrastructureNotProvisionedError, CreatorInfrastructureMismatchError }

/**
 * Resolve the creator's parent CSW + delegated Privy server signer.
 * Per-coin keeper EOAs are retired — this never mints a new wallet.
 */
export async function getOrCreateCreatorAgentWallet(params: {
  creatorToken: `0x${string}`
}): Promise<{ walletId: string; address: `0x${string}` }> {
  const wallet = await resolveCreatorExecutionWallet(params)
  return { walletId: wallet.walletId, address: wallet.address }
}

/** @deprecated Schema lives in creator_infrastructure migration; no runtime DDL. */
export async function ensureCreatorAgentWalletsSchema(_db: unknown): Promise<void> {
  return
}
