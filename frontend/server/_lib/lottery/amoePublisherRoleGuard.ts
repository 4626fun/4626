// Preflight: on-chain AMOE publisher role must match the broadcast sender.
// Prevents opaque UserOp estimate failures (`NotPublisher` → userop_submission_failed)
// when router roles drift from PROTOCOL_CSW.

import { getAddress, isAddressEqual, type Address, type Hex, type PublicClient } from 'viem'

export const AMOE_PUBLISHER_ROLE_MISMATCH = 'amoe_publisher_role_mismatch' as const

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
  publicClient: PublicClient
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
    onChainPublisher,
    expectedSender: args.expectedSender,
  })
}

export async function requirePointsLedgerPublisherMatchesSender(args: {
  publicClient: PublicClient
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
    onChainPublisher,
    expectedSender: args.expectedSender,
  })
}
