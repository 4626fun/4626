import {
  ADD_OWNER_ADDRESS_SELECTOR,
  ENTRY_POINT_V06_BASE,
  RELAY_DEPOSITORY_BASE,
  RELAY_MULTICALL_SELECTOR,
} from '@/lib/wallet/cswOwnerAbi'
import type { PublicClient } from 'viem'

/** Relay Settlement router on Base mainnet — must not be the addOwner call target. */
export const RELAY_ROUTER_BASE = '0xb92fe925dc43a0ecde6c8b1a2709c170ec4fff4f' as const

export type AddOwnerTxRequestShape = {
  to: `0x${string}`
  data: `0x${string}`
  value?: string
}

export type SendCallsCallShape = {
  to: `0x${string}`
  data: `0x${string}`
  value?: bigint | `0x${string}`
}

const ROUTER_MULTICALL_BLOCKED_MESSAGE =
  'RelayRouter multicall blocked: addOwner must run inside an ERC-4337 UserOperation where the smart wallet executes addOwnerAddress on itself (msg.sender == address(this)). Do not submit addOwner through the router — the router is not an owner and authorization will reject.'

function normalizeCallValue(value: SendCallsCallShape['value']): bigint {
  if (value === undefined) return 0n
  if (typeof value === 'bigint') return value
  if (typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value)) return BigInt(value)
  throw new Error('Invalid wallet_sendCalls call value.')
}

function isBlockedRelayTarget(toLower: string): boolean {
  return (
    toLower === RELAY_ROUTER_BASE.toLowerCase() ||
    toLower === RELAY_DEPOSITORY_BASE.toLowerCase()
  )
}

export function assertAddOwnerSelfCallShape(params: {
  csw: string
  txRequest: AddOwnerTxRequestShape
}): void {
  const cswLower = params.csw.trim().toLowerCase()
  const toLower = params.txRequest.to.trim().toLowerCase()
  const selector = params.txRequest.data.slice(0, 10).toLowerCase()

  if (isBlockedRelayTarget(toLower)) {
    throw new Error(ROUTER_MULTICALL_BLOCKED_MESSAGE)
  }

  if (selector === RELAY_MULTICALL_SELECTOR.toLowerCase()) {
    throw new Error(ROUTER_MULTICALL_BLOCKED_MESSAGE)
  }

  if (toLower !== cswLower) {
    throw new Error(
      'Prepared transaction target must be the canonical CSW self-call (to == csw), not an external router or depository.',
    )
  }

  if (selector !== ADD_OWNER_ADDRESS_SELECTOR.toLowerCase()) {
    throw new Error(
      `Expected addOwnerAddress selector ${ADD_OWNER_ADDRESS_SELECTOR}, got ${selector || '(empty)'}.`,
    )
  }
}

/**
 * EntryPoint UserOp lane for /add: exactly one zero-value CSW → CSW addOwnerAddress call.
 * Rejects Relay Part 1 deposit bundles and any router/depository targets.
 */
export function assertSendCallsEntryPointAddOwnerBundle(params: {
  csw: string
  calls: SendCallsCallShape[]
}): void {
  if (params.calls.length !== 1) {
    throw new Error(
      `EntryPoint UserOp addOwner requires exactly one CSW self-call in wallet_sendCalls. Got ${params.calls.length} calls — do not bundle Relay deposit or router multicall here.`,
    )
  }

  const call = params.calls[0]!
  assertAddOwnerSelfCallShape({
    csw: params.csw,
    txRequest: { to: call.to, data: call.data },
  })

  if (normalizeCallValue(call.value) !== 0n) {
    throw new Error(
      'EntryPoint UserOp addOwner self-call must have zero native value. Relay deposit legs belong in a separate UserOp, not bundled with addOwner on /add.',
    )
  }
}

/**
 * Successful owner installs land in an outer transaction to EntryPoint v0.6 (handleOps).
 * Router multicall attempts use a different `to` and will fail this check.
 */
export async function verifyEntryPointHandleOpsTransaction(params: {
  publicClient: Pick<PublicClient, 'getTransaction'>
  txHash: `0x${string}`
}): Promise<void> {
  const tx = await params.publicClient.getTransaction({ hash: params.txHash })
  const to = tx.to?.toLowerCase() ?? ''
  if (to !== ENTRY_POINT_V06_BASE.toLowerCase()) {
    throw new Error(
      `Expected landed transaction to call EntryPoint ${ENTRY_POINT_V06_BASE} via handleOps. Got to=${tx.to ?? '(create)'}. ` +
        'If addOwner was embedded in RelayRouter multicall, authorization fails and your CSW funds stay untouched.',
    )
  }
}
