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
  /**
   * - `smart_wallet` — 4626's own Privy app smart wallet (via
   *   `useSmartWallets`). ERC-4337 account; when it is on the CSW owner
   *   list (installed by the waitlist "Enable 4626 signing" step), its
   *   `signTypedData` produces an ERC-1271 signature that the commit
   *   endpoint validates via `parentCsw.isValidSignature`.
   * - `external` — a connected browser EOA (Rabby / MetaMask / CBW).
   *   Relevant for power users who manually add their own EOA as an
   *   owner of the CSW.
   * - `embedded` — the 4626 Privy embedded EOA. Almost never an owner
   *   of a Zora-cross-app CSW; kept as a low-priority candidate so the
   *   few rare cases still work.
   */
  label: 'smart_wallet' | 'external' | 'embedded'
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
 * Pick the preferred signer for a fresh SpendPermission signature.
 *
 * Preference order (highest first):
 *   1. 4626 Privy app smart wallet (ERC-1271) — the universal path for
 *      Zora-cross-app users who completed the waitlist owner-install
 *      step. Works without any external wallet connection, no passkey
 *      popup, consistent UX.
 *   2. External EOA (Rabby / MetaMask / CBW) that is a CSW owner —
 *      for power users like profile 1 who manually added their own
 *      EOA to the CSW owner list.
 *   3. Privy embedded EOA if it is a CSW owner — extremely rare path,
 *      only applies to accounts created directly through 4626 Privy
 *      without cross-app (not the normal production flow).
 *   4. null — nothing available to sign with; the card should prompt
 *      the user to complete owner install or connect an owner wallet.
 */
export function pickOwnerSigner(results: CswOwnerResult[]): CswOwnerResult | null {
  return (
    results.find((r) => r.label === 'smart_wallet' && r.isOwner) ??
    results.find((r) => r.label === 'external' && r.isOwner) ??
    results.find((r) => r.label === 'embedded' && r.isOwner) ??
    null
  )
}
