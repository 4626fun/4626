import type { Address, PublicClient } from 'viem'

/**
 * Shared helpers for checking CoinbaseSmartWallet ownership of a given
 * EOA against the parent CSW. Used by both:
 *
 *   - `useAutoProvisionSubAccount` — to decide whether auto-provision
 *     is safe to fire without a user click
 *   - the `ExecutionScopeCard` `not_provisioned` state — to show the
 *     user which of their connected signers will be used for the
 *     SpendPermission signature
 *
 * We check the Privy embedded EOA AND any currently-connected external
 * EOA (Rabby / MetaMask / Coinbase Wallet). Either one qualifies — the
 * /api/arch-b/sub-account/provision/commit endpoint accepts signatures
 * from any EOA that passes `CoinbaseSmartWallet.isOwnerAddress` (plus
 * ERC-1271 fallback) on the parent CSW.
 *
 * This is specifically important for Zora-cross-app profiles whose CSW
 * was created outside Privy — the Privy embedded EOA isn't on the CSW
 * owner list, but the user's existing Rabby / MetaMask likely is. Arch B
 * is designed for exactly this scenario: the sub-account co-ownership
 * lets the embedded EOA sign *sub-account* UserOps after one-time
 * SpendPermission signing from a parent-CSW owner.
 */

export const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export type CswOwnerCandidate = {
  label: 'embedded' | 'external'
  address: Address
}

export type CswOwnerResult = CswOwnerCandidate & { isOwner: boolean }

/**
 * Query `isOwnerAddress(candidate)` on the parent CSW for each
 * candidate in parallel. Candidates with unreadable addresses or
 * failing RPC calls surface as `isOwner: false`; we don't throw,
 * because the card should still render a reasonable empty state if
 * the RPC briefly fails.
 *
 * Returns the candidates in the order they were passed in. The
 * auto-provision hook prefers external-over-embedded when picking a
 * signer, because external wallets (Rabby / MetaMask / CBW) are
 * typically the ones actually on the CSW owner list for Zora-cross-app
 * flows.
 */
export async function checkCswOwners(args: {
  publicClient: Pick<PublicClient, 'readContract'>
  csw: Address
  candidates: CswOwnerCandidate[]
}): Promise<CswOwnerResult[]> {
  const { publicClient, csw, candidates } = args
  if (candidates.length === 0) return []
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const isOwner = (await publicClient.readContract({
          address: csw,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [candidate.address],
        })) as boolean
        return { ...candidate, isOwner }
      } catch {
        return { ...candidate, isOwner: false }
      }
    }),
  )
  return results
}

/**
 * Pick the preferred signer to use for a fresh SpendPermission
 * signature. Preference order:
 *
 *   1. External EOA (Rabby / MetaMask / CBW) that is a CSW owner —
 *      prefer this because it's what Zora-cross-app users already use
 *      to interact with their CSW, and it avoids any Privy embedded
 *      wallet side effects.
 *   2. Privy embedded EOA if it is a CSW owner.
 *   3. null — nothing available to sign with; the card should prompt
 *      the user to connect an owner wallet.
 */
export function pickOwnerSigner(results: CswOwnerResult[]): CswOwnerResult | null {
  return (
    results.find((r) => r.label === 'external' && r.isOwner) ??
    results.find((r) => r.label === 'embedded' && r.isOwner) ??
    null
  )
}
