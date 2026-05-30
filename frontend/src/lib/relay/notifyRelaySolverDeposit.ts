import { apiFetch } from '@/lib/api/apiBase'
import type { OwnerMutationEip5792Call } from '@/lib/relay/ownerMutationTypes'

export type NotifyRelaySolverDepositClientResult = {
  indexed: boolean
  sameChainSingle: boolean
  warnings: string[]
}

/**
 * Ask the server to wake Relay's solver after Part 1 deposit confirms.
 * Uses RELAY_API_KEY server-side — never expose the key to the browser.
 */
export async function notifyRelaySolverAfterPart1Deposit(params: {
  chainId: number
  depositTxHash: `0x${string}`
  indexRequestIds?: `0x${string}`[]
  userCall: OwnerMutationEip5792Call
  referrer?: string
}): Promise<NotifyRelaySolverDepositClientResult> {
  const response = await apiFetch('/api/relay/notify-deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      chainId: params.chainId,
      depositTxHash: params.depositTxHash,
      indexRequestIds: params.indexRequestIds,
      userCall: params.userCall,
      referrer: params.referrer,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: NotifyRelaySolverDepositClientResult; error?: string }
    | null

  if (!response.ok || !payload?.success || !payload.data) {
    const message =
      payload && typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : `Relay notify-deposit failed (${response.status})`
    throw new Error(message)
  }

  return payload.data
}
