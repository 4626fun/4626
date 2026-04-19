import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'

/**
 * Client-side hook that drives the full sub-account re-provision
 * lifecycle:
 *
 *   1. POST /api/arch-b/sub-account/provision/prepare  → typed-data payload
 *   2. walletClient.signTypedData(payload)             → EIP-712 signature
 *   3. POST /api/arch-b/sub-account/provision/commit   → DB row written
 *
 * Called from the `ExecutionScopeCard` when a user wants to refresh or
 * re-establish their spend permission (after a revoke, expiry, or cap
 * change). Also used by the auto-provision hook in PR 3.
 *
 * Signature expectations:
 *  - The connected wallet must be an on-chain owner of the parent CSW.
 *    For Privy-canonical users, that's the embedded EOA (which Privy
 *    exposes through wagmi's `useWalletClient` when it's the active
 *    wallet).
 *  - If the active wagmi wallet is NOT a CSW owner (e.g. a new external
 *    wallet the user just connected), the commit step returns
 *    `signer_not_owner` and we surface that so the user can swap
 *    wallets.
 */

type PrepareResponse = {
  profileId: number
  subAccountAddress: Address
  parentCswAddress: Address
  ownerEoaAddress: Address
  privyOwnerWalletId: string
  permission: Record<string, unknown>
  permissionHash: Hex
  eip712: {
    domain: Record<string, unknown>
    types: Record<string, unknown>
    primaryType: string
    message: Record<string, unknown>
  }
  perTxCapWei: string
  dailyCapWei: string
}

export type ReprovisionResult =
  | {
      ok: true
      subAccountAddress: Address
      parentCswAddress: Address
      permissionHash: Hex
    }
  | {
      ok: false
      code: string
      message: string
    }

export type UseReprovisionReturn = {
  busy: boolean
  phase: 'idle' | 'preparing' | 'signing' | 'committing' | 'done' | 'error'
  error: string | null
  reprovision: (caps?: { perTxCapWei?: string; dailyCapWei?: string }) => Promise<ReprovisionResult>
}

export function useReprovisionSubAccount(): UseReprovisionReturn {
  const { data: walletClient } = useWalletClient()
  const [phase, setPhase] = useState<UseReprovisionReturn['phase']>('idle')
  const [error, setError] = useState<string | null>(null)

  const reprovision = useCallback(
    async (caps?: {
      perTxCapWei?: string
      dailyCapWei?: string
    }): Promise<ReprovisionResult> => {
      setError(null)

      if (!walletClient) {
        const msg = 'Connect a wallet that owns your CSW before re-provisioning.'
        setError(msg)
        setPhase('error')
        return { ok: false, code: 'no_wallet_client', message: msg }
      }

      // ─── 1. Prepare ────────────────────────────────────────────────
      setPhase('preparing')
      const prepRes = await apiFetch('/api/arch-b/sub-account/provision/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(caps ? { caps } : {}),
      })
      const prepBody = (await prepRes.json().catch(() => ({}))) as {
        success?: boolean
        data?: PrepareResponse
        error?: string
      }
      if (!prepRes.ok || !prepBody.success || !prepBody.data) {
        const code = prepBody.error ?? `prepare_status_${prepRes.status}`
        const message = humanizeProvisionError(code)
        setError(message)
        setPhase('error')
        return { ok: false, code, message }
      }
      const prep = prepBody.data

      // ─── 2. Sign ───────────────────────────────────────────────────
      setPhase('signing')
      let signature: Hex
      try {
        // `signTypedData` has an overloaded signature whose types collapse
        // to `never` when `types` is a loose `Record<string, unknown>` from
        // the API response. The payload is validated server-side and we
        // re-verify the recovered signer on commit, so a local `any` cast
        // here is safe and avoids a large generic shim.
        const signArgs = {
          account: walletClient.account?.address as Address,
          domain: prep.eip712.domain,
          types: prep.eip712.types,
          primaryType: prep.eip712.primaryType,
          message: prep.eip712.message,
        }
        signature = await (walletClient.signTypedData as unknown as (args: typeof signArgs) => Promise<Hex>)(
          signArgs,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(rejectionMessage(message))
        setPhase('error')
        return { ok: false, code: 'signing_rejected', message }
      }

      // ─── 3. Commit ─────────────────────────────────────────────────
      setPhase('committing')
      const commitRes = await apiFetch('/api/arch-b/sub-account/provision/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subAccountAddress: prep.subAccountAddress,
          parentCswAddress: prep.parentCswAddress,
          permission: prep.permission,
          permissionHash: prep.permissionHash,
          signature,
          perTxCapWei: prep.perTxCapWei,
          dailyCapWei: prep.dailyCapWei,
          privyOwnerWalletId: prep.privyOwnerWalletId,
          ownerEoaAddress: prep.ownerEoaAddress,
        }),
      })
      const commitBody = (await commitRes.json().catch(() => ({}))) as {
        success?: boolean
        data?: unknown
        error?: string
      }
      if (!commitRes.ok || !commitBody.success) {
        const code = commitBody.error ?? `commit_status_${commitRes.status}`
        const message = humanizeProvisionError(code)
        setError(message)
        setPhase('error')
        return { ok: false, code, message }
      }

      setPhase('done')
      return {
        ok: true,
        subAccountAddress: prep.subAccountAddress,
        parentCswAddress: prep.parentCswAddress,
        permissionHash: prep.permissionHash,
      }
    },
    [walletClient],
  )

  return {
    busy: phase === 'preparing' || phase === 'signing' || phase === 'committing',
    phase,
    error,
    reprovision,
  }
}

function humanizeProvisionError(code: string): string {
  switch (code) {
    case 'profile_not_ready':
    case 'profile_missing_privy_user':
    case 'profile_missing_owner_eoa':
    case 'profile_missing_parent_csw':
      return 'Your account is not fully set up yet. Finish the waitlist flow first.'
    case 'missing_privy_wallet':
      return 'No Privy signer is attached to your account. Reconnect and try again.'
    case 'invalid_caps':
      return 'Requested spend caps are outside of allowed limits.'
    case 'signer_not_owner':
      return 'The connected wallet is not a current owner of your CSW. Switch to an owner wallet and retry.'
    case 'invalid_signature':
    case 'signature_verification_failed':
      return "We couldn't verify your signature. Please retry — if it persists, try a different wallet."
    case 'privy_delegation_missing':
      return 'Privy delegation to 4626 is missing. Enable in-chat spending from the setup flow first.'
    case 'db_unavailable':
      return 'Database is temporarily unavailable. Please try again in a minute.'
    default:
      return `Re-provisioning failed (${code}). Please retry or contact support if it persists.`
  }
}

function rejectionMessage(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('rejected') || lower.includes('denied') || lower.includes('cancelled')) {
    return 'Signature was rejected in your wallet. No changes made.'
  }
  return `Signing failed: ${raw}`
}
