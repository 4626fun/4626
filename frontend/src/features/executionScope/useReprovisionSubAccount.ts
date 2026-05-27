import { useCallback, useState } from 'react'
import type { Address, Hex } from 'viem'
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { useWalletClient } from 'wagmi'

import { apiFetch } from '@/lib/api/apiBase'

import { useArchBDelegation } from '@/features/archB/useArchBDelegation'
import { useCswOwnerSigner } from './useCswOwnerSigner'

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
  phase: 'idle' | 'delegating' | 'preparing' | 'signing' | 'committing' | 'done' | 'error'
  error: string | null
  reprovision: (caps?: { perTxCapWei?: string; dailyCapWei?: string }) => Promise<ReprovisionResult>
}

export function useReprovisionSubAccount(): UseReprovisionReturn {
  const { data: walletClient } = useWalletClient()
  const { client: smartWalletClient } = useSmartWallets()
  const { ensureDelegation } = useArchBDelegation()
  const ownerCheck = useCswOwnerSigner()
  const [phase, setPhase] = useState<UseReprovisionReturn['phase']>('idle')
  const [error, setError] = useState<string | null>(null)

  const reprovision = useCallback(
    async (caps?: {
      perTxCapWei?: string
      dailyCapWei?: string
    }    ): Promise<ReprovisionResult> => {
      setError(null)

      // Decide up-front which signer path we'll use so we can log the
      // choice + surface it in telemetry when the commit succeeds.
      // Priority order is enforced by `pickOwnerSigner` in
      // `cswOwnerCheck.ts`: external > embedded > smart_wallet.
      const preferredSigner = ownerCheck.preferredSigner
      const signerPath = preferredSigner?.label ?? null

      if (!signerPath) {
        const msg =
          'No wallet that owns your CSW is available. Finish the waitlist owner-install step, or connect an owner wallet (Rabby / MetaMask / Coinbase Wallet), then retry.'
        setError(msg)
        setPhase('error')
        return { ok: false, code: 'no_owner_signer', message: msg }
      }

      if (signerPath === 'smart_wallet' && !smartWalletClient) {
        const msg =
          'Smart-wallet signer is the expected path for your account but Privy has not initialized it yet. Refresh the page and retry.'
        setError(msg)
        setPhase('error')
        return { ok: false, code: 'smart_wallet_not_ready', message: msg }
      }

      if (signerPath !== 'smart_wallet' && !walletClient) {
        const msg = 'Connect the wallet that owns your CSW before re-provisioning.'
        setError(msg)
        setPhase('error')
        return { ok: false, code: 'no_wallet_client', message: msg }
      }

      // ─── 0. Privy delegation ───────────────────────────────────────
      // Commit verifies the embedded EOA has delegated to the Arch B quorum
      // before accepting the signed SpendPermission. Run this before prepare
      // so users see the Privy consent modal first, then the CSW-owner sign.
      setPhase('delegating')
      const delegationResult = await ensureDelegation()
      if (!delegationResult.ok) {
        const message = humanizeDelegationError(
          delegationResult.error.code,
          delegationResult.error.message,
        )
        setError(message)
        setPhase('error')
        return { ok: false, code: delegationResult.error.code, message }
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
        // The Privy smart-wallet client (useSmartWallets) signs via its
        // account's ERC-1271 path — the resulting signature validates
        // against `parentCsw.isValidSignature(hash, sig)` on-chain,
        // which is exactly the fallback the commit endpoint's
        // `verifyParentCswSignature` tries second after EOA recovery.
        // That's the universal path for Zora-cross-app profiles.
        //
        // The EOA path (`walletClient.signTypedData`) produces a plain
        // 65-byte secp256k1 signature and only validates when the
        // signing EOA is itself a current CSW owner — which is the
        // profile-1 / power-user shape.
        //
        // The `signTypedData` overload collapses `types` to `never`
        // when passed loose JSON, so we cast the call once. The server
        // re-verifies everything regardless of which path signed.
        if (signerPath === 'smart_wallet') {
          const client = smartWalletClient as unknown as {
            signTypedData: (args: {
              account: Address
              domain: unknown
              types: unknown
              primaryType: string
              message: unknown
            }) => Promise<Hex>
            account: { address: Address }
          }
          signature = await client.signTypedData({
            account: client.account.address,
            domain: prep.eip712.domain,
            types: prep.eip712.types,
            primaryType: prep.eip712.primaryType,
            message: prep.eip712.message,
          })
          // Telemetry: narrow console marker so we can grep this path
          // in production frontend logs and see how often ERC-1271
          // signatures are being produced + validated.

          console.info('[arch-b/subacct/reprovision] signed via smart_wallet (ERC-1271)', {
            csw: prep.parentCswAddress,
            sigLen: signature?.length,
          })
        } else {
          const client = walletClient as unknown as NonNullable<typeof walletClient>
          const signerAddress = preferredSigner?.address ?? (client.account?.address as Address)
          const signArgs = {
            account: signerAddress,
            domain: prep.eip712.domain,
            types: prep.eip712.types,
            primaryType: prep.eip712.primaryType,
            message: prep.eip712.message,
          }
          signature = await (
            client.signTypedData as unknown as (args: typeof signArgs) => Promise<Hex>
          )(signArgs)

          console.info(
            `[arch-b/subacct/reprovision] signed via ${signerPath} EOA (secp256k1)`,
            { csw: prep.parentCswAddress, signer: signArgs.account, sigLen: signature?.length },
          )
        }
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
    // react-compiler preserve-manual-memoization: the callback body reads
    // `smartWalletClient` (line 99) and `ownerCheck.preferredSigner?.label`
    // (line 89), so both must be in the deps array alongside `walletClient`.
    [walletClient, smartWalletClient, ownerCheck.preferredSigner, ensureDelegation],
  )

  return {
    busy:
      phase === 'delegating' ||
      phase === 'preparing' ||
      phase === 'signing' ||
      phase === 'committing',
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
      return "We couldn't verify your signature. If you use an external wallet, connect it and retry. Otherwise try a different owner wallet."
    case 'privy_delegation_missing':
      return '4626 agent signing is not delegated on your Privy embedded wallet yet. Click Enable again and approve the Privy delegation prompt first.'
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

function humanizeDelegationError(code: string, fallbackMessage: string): string {
  switch (code) {
    case 'not_ready':
      return 'Privy is still initializing. Refresh the page and try again.'
    case 'unauthenticated':
      return 'Sign in with your 4626 account before enabling XMTP chat commands.'
    case 'no_embedded_wallet':
      return 'No Privy embedded signer found. Sign in with email OTP on the waitlist flow first.'
    case 'delegation_declined':
      return fallbackMessage.includes('declined') || fallbackMessage.includes('cancel')
        ? 'Delegation was declined in Privy. No changes were made.'
        : fallbackMessage
    default:
      return fallbackMessage || `Delegation failed (${code}). Please retry.`
  }
}
