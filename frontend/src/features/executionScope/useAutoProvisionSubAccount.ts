import { useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { base } from 'viem/chains'
import { usePublicClient } from 'wagmi'

import { toast } from '@/components/ui/Toast'
import { useCanonicalIdentity } from '@/hooks/useCanonicalIdentity'

import { useExecutionScope } from './useExecutionScope'
import { useReprovisionSubAccount } from './useReprovisionSubAccount'

/**
 * One-shot auto-provisioning hook.
 *
 * When a creator lands on an identity-focused surface (today: the
 * `/accounts` page) with:
 *   1. An authenticated SIWE session,
 *   2. A canonical Coinbase Smart Wallet resolved,
 *   3. A Privy embedded EOA present, AND
 *   4. That EOA is ALREADY an owner of the CSW (via `isOwnerAddress`),
 *
 * and no sub-account has been provisioned yet, this hook kicks off the
 * prepare → signTypedData → commit flow automatically. The user still
 * sees the wallet's signature modal — we DO NOT attempt truly silent
 * signing, because:
 *
 *   - SpendPermission is a financial consent; a modal makes that
 *     explicit and auditable.
 *   - Privy's headless signing path requires a separate delegation
 *     handshake. Users who haven't gone through that flow would
 *     otherwise see an unexpected popup on every sign-in.
 *
 * By scoping the mount to `/accounts` (not the root app shell), we
 * guarantee users only see the auto-provision modal on a page whose
 * entire purpose is identity management.
 *
 * Session-scoped: once the hook fires (successfully or not) for a
 * given CSW, a `sessionStorage` flag prevents it from re-firing until
 * the browser tab is closed. If the user rejects the signature,
 * they can re-attempt via the manual "Enable in-chat commands" button
 * on the card.
 */

const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function sessionKeyFor(csw: Address | null | undefined): string | null {
  if (!csw) return null
  return `4626:subacct:autoprov:${csw.toLowerCase()}`
}

/**
 * Public status surface. UI can inspect this to show "auto-provisioning…"
 * copy while the signature modal is being assembled, but the primary
 * side effect is the automatic call into `reprovision()`.
 */
export type AutoProvisionStatus =
  | 'inert' // hook has not decided yet, or preconditions didn't hold
  | 'ineligible' // embedded EOA is not a CSW owner — can't auto-provision
  | 'already_provisioned' // sub-account row exists; nothing to do
  | 'triggering' // signature modal in flight
  | 'succeeded'
  | 'failed'

export function useAutoProvisionSubAccount(): {
  status: AutoProvisionStatus
  reason: string | null
} {
  const identity = useCanonicalIdentity()
  const scope = useExecutionScope()
  const reprovision = useReprovisionSubAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const [status, setStatus] = useState<AutoProvisionStatus>('inert')
  const [reason, setReason] = useState<string | null>(null)

  // Prevent multiple attempts in the same React mount (e.g. re-renders
  // while the signature modal is open).
  const attemptedRef = useRef(false)

  useEffect(() => {
    if (attemptedRef.current) return

    // Wait for scope + identity to finish resolving before deciding.
    if (scope.status === 'loading') return
    if (!identity.cswAddress || !identity.privyEmbeddedAddress) return

    // If there's already a sub-account row (active, revoked, or expired),
    // the manual card actions are the right surface — don't auto-retrigger.
    if (scope.status !== 'not_provisioned') {
      attemptedRef.current = true
      setStatus('already_provisioned')
      return
    }

    // Session-gate: only one auto-attempt per browser session per CSW.
    const key = sessionKeyFor(identity.cswAddress)
    if (key && typeof window !== 'undefined' && window.sessionStorage.getItem(key) === '1') {
      attemptedRef.current = true
      return
    }

    if (!publicClient) return

    let cancelled = false
    attemptedRef.current = true

    ;(async () => {
      try {
        const isOwner = (await publicClient.readContract({
          address: identity.cswAddress as Address,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [identity.privyEmbeddedAddress as Address],
        })) as boolean

        if (cancelled) return

        if (!isOwner) {
          // Embedded EOA is not a current owner of the CSW (e.g. Zora
          // cross-app flows where ownership structure differs). Leave
          // auto-provisioning inert; the manual CTA on the card still
          // lets the user proceed with an external owner wallet.
          setStatus('ineligible')
          setReason(
            'Privy embedded signer is not a current owner of the parent CSW. Use the manual enable flow with an owner wallet.',
          )
          if (key && typeof window !== 'undefined') {
            window.sessionStorage.setItem(key, '1')
          }
          return
        }

        // Preconditions satisfied — kick off the signature flow.
        setStatus('triggering')
        if (key && typeof window !== 'undefined') {
          // Stamp the session key BEFORE the modal opens so a quick
          // re-render or React strict-mode double-fire can't retrigger.
          window.sessionStorage.setItem(key, '1')
        }

        const result = await reprovision.reprovision()
        if (cancelled) return
        if (result.ok) {
          setStatus('succeeded')
          scope.refresh()
          toast.success(
            'In-chat commands are enabled. 4626 can now execute /coin buy, /coin sell, /keepr send within your signed caps. Manage this any time in Accounts.',
          )
        } else {
          setStatus('failed')
          setReason(result.message)
          // Silent at the toast layer — the card will surface the error
          // inline. Users who rejected the signature shouldn't get a
          // red toast over it.
        }
      } catch (err) {
        if (cancelled) return
        setStatus('failed')
        setReason(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    identity.cswAddress,
    identity.privyEmbeddedAddress,
    publicClient,
    reprovision,
    scope,
  ])

  return { status, reason }
}
