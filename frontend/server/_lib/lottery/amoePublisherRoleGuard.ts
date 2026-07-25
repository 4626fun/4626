// Preflight: on-chain AMOE publisher role must match the broadcast sender.
// Prevents opaque UserOp estimate failures (`NotPublisher` → userop_submission_failed)
// when router roles drift from PROTOCOL_CSW.

import { getAddress, isAddressEqual, type Address, type Hex } from 'viem'

export const AMOE_PUBLISHER_ROLE_MISMATCH = 'amoe_publisher_role_mismatch' as const
export const AMOE_ALLOWLIST_ROOT_MISMATCH = 'amoe_allowlist_root_mismatch' as const
export const AMOE_LEDGER_ROOT_MISMATCH = 'amoe_ledger_root_mismatch' as const

/** bytes32(0) — unpublished root on LotteryAmoeRouter. */
export const AMOE_ZERO_ROOT = ('0x' + '00'.repeat(32)) as `0x${string}`

/**
 * DB sentinel for `publish_tx_hash` when the on-chain root already matches
 * the snapshot and we skip broadcasting. Column is TEXT (not bytes32).
 */
export const AMOE_ON_CHAIN_RECONCILED_TX = 'reconciled:on-chain' as const

/**
 * Structural reader — avoids TS2719 when callers construct clients via a
 * different `viem` resolution path (static import vs dynamic `import('viem')`).
 */
export type AmoeChainReader = {
  readContract: (parameters: {
    address: Hex
    abi: readonly unknown[] | unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

const ALLOWLIST_PUBLISHER_ABI = [
  {
    type: 'function',
    name: 'allowlistPublisher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const POINTS_LEDGER_PUBLISHER_ABI = [
  {
    type: 'function',
    name: 'pointsLedgerPublisher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const ALLOWLIST_ROOT_OF_ABI = [
  {
    type: 'function',
    name: 'allowlistRootOf',
    stateMutability: 'view',
    inputs: [{ name: 'epoch', type: 'uint64' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const

const POINTS_LEDGER_ROOT_OF_ABI = [
  {
    type: 'function',
    name: 'pointsLedgerRootOf',
    stateMutability: 'view',
    inputs: [{ name: 'epoch', type: 'uint64' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const

export type AmoePublisherRole = 'allowlistPublisher' | 'pointsLedgerPublisher'

export function assertPublisherRoleMatchesSender(args: {
  role: AmoePublisherRole
  onChainPublisher: Address | string
  expectedSender: Address | string
}): void {
  const onChain = getAddress(args.onChainPublisher)
  const expected = getAddress(args.expectedSender)
  if (!isAddressEqual(onChain, expected)) {
    throw new Error(
      `${AMOE_PUBLISHER_ROLE_MISMATCH} role=${args.role} onChain=${onChain} expected=${expected}`,
    )
  }
}

export async function requireAllowlistPublisherMatchesSender(args: {
  publicClient: AmoeChainReader
  lotteryAmoeRouter: Hex
  expectedSender: Address | string
}): Promise<void> {
  const onChainPublisher = await args.publicClient.readContract({
    address: args.lotteryAmoeRouter,
    abi: ALLOWLIST_PUBLISHER_ABI,
    functionName: 'allowlistPublisher',
  })
  assertPublisherRoleMatchesSender({
    role: 'allowlistPublisher',
    onChainPublisher: onChainPublisher as Address | string,
    expectedSender: args.expectedSender,
  })
}

export async function requirePointsLedgerPublisherMatchesSender(args: {
  publicClient: AmoeChainReader
  lotteryAmoeRouter: Hex
  expectedSender: Address | string
}): Promise<void> {
  const onChainPublisher = await args.publicClient.readContract({
    address: args.lotteryAmoeRouter,
    abi: POINTS_LEDGER_PUBLISHER_ABI,
    functionName: 'pointsLedgerPublisher',
  })
  assertPublisherRoleMatchesSender({
    role: 'pointsLedgerPublisher',
    onChainPublisher: onChainPublisher as Address | string,
    expectedSender: args.expectedSender,
  })
}

export async function readAllowlistRootOf(args: {
  publicClient: AmoeChainReader
  lotteryAmoeRouter: Hex
  epoch: bigint
}): Promise<`0x${string}`> {
  const root = await args.publicClient.readContract({
    address: args.lotteryAmoeRouter,
    abi: ALLOWLIST_ROOT_OF_ABI,
    functionName: 'allowlistRootOf',
    args: [args.epoch],
  })
  return root as `0x${string}`
}

export async function readPointsLedgerRootOf(args: {
  publicClient: AmoeChainReader
  lotteryAmoeRouter: Hex
  epoch: bigint
}): Promise<`0x${string}`> {
  const root = await args.publicClient.readContract({
    address: args.lotteryAmoeRouter,
    abi: POINTS_LEDGER_ROOT_OF_ABI,
    functionName: 'pointsLedgerRootOf',
    args: [args.epoch],
  })
  return root as `0x${string}`
}

export function normalizeRootHex(root: string): `0x${string}` {
  const trimmed = root.trim().toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(trimmed)) {
    throw new Error(`invalid_root_hex ${root}`)
  }
  return trimmed as `0x${string}`
}

export function isZeroRoot(root: string): boolean {
  return normalizeRootHex(root) === AMOE_ZERO_ROOT
}
