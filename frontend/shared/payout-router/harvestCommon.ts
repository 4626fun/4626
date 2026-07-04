/**
 * Shared PayoutRouter harvest types + batch helpers (HTTP + KPR).
 * Keep plan logic in each runtime; keep batch shape/env parsing here.
 */

export type HexAddress = `0x${string}`

export const PAYOUT_ROUTER_HARVEST_ABI = [
  {
    type: 'function',
    name: 'processBatch',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'actions',
        type: 'tuple[]',
        components: [
          { name: 'kind', type: 'uint8' },
          { name: 'tokenIn', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'minOut', type: 'uint256' },
          { name: 'spender', type: 'address' },
          { name: 'swapTarget', type: 'address' },
          { name: 'swapCallData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'totalTokenOut', type: 'uint256' },
      { name: 'totalSharesQueued', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapTargets',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapSpenders',
    stateMutability: 'view',
    inputs: [{ name: 'spender', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'swapPathToShareOFT',
    stateMutability: 'view',
    inputs: [{ name: 'tokenIn', type: 'address' }],
    outputs: [{ type: 'bytes' }],
  },
] as const

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as HexAddress

export type PayoutRouterBatchAction = {
  kind: 0 | 1
  tokenIn: HexAddress
  amountIn: bigint
  minOut: bigint
  spender: HexAddress
  swapTarget: HexAddress
  swapCallData: HexAddress
}

export type HarvestTokenPlanEntry = {
  token: HexAddress
  label: string
  minOut: bigint
}

export type PlannedHarvestConversion = {
  token: HexAddress
  label: string
  balance: bigint
  route: 'v3' | 'external' | 'direct'
  action: PayoutRouterBatchAction
}

export type SkippedHarvestToken = {
  token: HexAddress
  label: string
  balance: bigint
  skippedReason: string
}

export function directBatchAction(tokenIn: HexAddress, amountIn: bigint, minOut: bigint): PayoutRouterBatchAction {
  return {
    kind: 0,
    tokenIn,
    amountIn,
    minOut,
    spender: ZERO_ADDRESS,
    swapTarget: ZERO_ADDRESS,
    swapCallData: '0x',
  }
}

export function externalBatchAction(params: {
  tokenIn: HexAddress
  amountIn: bigint
  minOut: bigint
  spender: HexAddress
  swapTarget: HexAddress
  swapCallData: HexAddress
}): PayoutRouterBatchAction {
  return {
    kind: 1,
    tokenIn: params.tokenIn,
    amountIn: params.amountIn,
    minOut: params.minOut,
    spender: params.spender,
    swapTarget: params.swapTarget,
    swapCallData: params.swapCallData,
  }
}

export function toProcessBatchArgs(conversions: PlannedHarvestConversion[]): PayoutRouterBatchAction[] {
  return conversions.map((entry) => entry.action)
}

export function parseHarvestBoolEnv(
  key: string,
  fallback: boolean,
  env: Record<string, string | undefined> = readProcessEnv(),
): boolean {
  const raw = String(env[key] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return fallback
}

export function parseHarvestBpsEnv(
  key: string,
  fallback: number,
  env: Record<string, string | undefined> = readProcessEnv(),
): number {
  const raw = String(env[key] ?? '').trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback
  if (parsed < 1 || parsed > 5_000) return fallback
  return parsed
}

export function parseHarvestPerTokenFallbackEnv(
  env: Record<string, string | undefined> = readProcessEnv(),
): boolean {
  return parseHarvestBoolEnv('PAYOUT_ROUTER_PER_TOKEN_FALLBACK', true, env)
}

function readProcessEnv(): Record<string, string | undefined> {
  if (typeof process !== 'undefined' && process.env) return process.env
  return {}
}

declare const process: { env: Record<string, string | undefined> }
