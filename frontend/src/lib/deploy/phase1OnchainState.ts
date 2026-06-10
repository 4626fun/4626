import { getAddress, isAddress, type Address, type Hex } from 'viem'

import type { FinalizePhase2Params } from './finalizeShareBridgeFee'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export const BATCHER_PHASE1_SPLIT_STATE_ABI = [
  {
    type: 'function',
    name: 'phase1SplitStates',
    stateMutability: 'view',
    inputs: [{ name: 'baseSalt', type: 'bytes32' }],
    outputs: [
      { name: 'oftBootstrapRegistry', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'shareOFT', type: 'address' },
      { name: 'shareOftSalt', type: 'bytes32' },
      { name: 'paramsHash', type: 'bytes32' },
      { name: 'codeIdsHash', type: 'bytes32' },
      { name: 'coreDone', type: 'bool' },
      { name: 'finalized', type: 'bool' },
    ],
  },
] as const

export type Phase1SplitState = {
  vault: Address | null
  wrapper: Address | null
  shareOFT: Address | null
  coreDone: boolean
  finalized: boolean
}

type Phase1ReadClient = {
  readContract(args: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }): Promise<unknown>
  getBytecode(args: { address: Address }): Promise<Hex | undefined>
}

function normalizeDeployedAddress(value: unknown): Address | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  const normalized = getAddress(value as Address)
  if (normalized.toLowerCase() === ZERO_ADDRESS.toLowerCase()) return null
  return normalized
}

function readTupleField(raw: unknown, key: string, index: number): unknown {
  if (Array.isArray(raw)) return raw[index]
  if (raw && typeof raw === 'object') return (raw as Record<string, unknown>)[key]
  return undefined
}

export function parsePhase1SplitState(raw: unknown): Phase1SplitState {
  return {
    vault: normalizeDeployedAddress(readTupleField(raw, 'vault', 1)),
    wrapper: normalizeDeployedAddress(readTupleField(raw, 'wrapper', 2)),
    shareOFT: normalizeDeployedAddress(readTupleField(raw, 'shareOFT', 3)),
    coreDone: Boolean(readTupleField(raw, 'coreDone', 7)),
    finalized: Boolean(readTupleField(raw, 'finalized', 8)),
  }
}

async function hasBytecode(client: Phase1ReadClient, address: Address | null): Promise<boolean> {
  if (!address) return false
  const code = await client.getBytecode({ address }).catch(() => undefined)
  return Boolean(code && code !== '0x')
}

export async function readPhase1SplitState(params: {
  publicClient: Phase1ReadClient
  batcherAddress: Address
  baseSalt: Hex
}): Promise<Phase1SplitState> {
  const raw = await params.publicClient.readContract({
    address: params.batcherAddress,
    abi: BATCHER_PHASE1_SPLIT_STATE_ABI,
    functionName: 'phase1SplitStates',
    args: [params.baseSalt],
  })
  return parsePhase1SplitState(raw)
}

/** Vault/wrapper/shareOFT only when batcher marks core done and bytecode exists. */
export async function readDeployedPhase1CoreAddresses(params: {
  publicClient: Phase1ReadClient
  batcherAddress: Address
  baseSalt: Hex
}): Promise<{
  state: Phase1SplitState
  vault: Address | null
  wrapper: Address | null
  shareOFT: Address | null
}> {
  const state = await readPhase1SplitState(params)
  if (!state.coreDone) {
    return { state, vault: null, wrapper: null, shareOFT: null }
  }

  const [vaultDeployed, wrapperDeployed, shareDeployed] = await Promise.all([
    hasBytecode(params.publicClient, state.vault),
    hasBytecode(params.publicClient, state.wrapper),
    hasBytecode(params.publicClient, state.shareOFT),
  ])

  return {
    state,
    vault: vaultDeployed ? state.vault : null,
    wrapper: wrapperDeployed ? state.wrapper : null,
    shareOFT: shareDeployed ? state.shareOFT : null,
  }
}

export function mergePipeAFinalizeParams(
  predicted: FinalizePhase2Params,
  onChain: { vault?: Address | null; wrapper?: Address | null; shareOFT?: Address | null } | null | undefined,
): FinalizePhase2Params {
  if (!onChain) return predicted
  return {
    ...predicted,
    vault: onChain.vault ?? predicted.vault,
    wrapper: onChain.wrapper ?? predicted.wrapper,
    shareOFT: onChain.shareOFT ?? predicted.shareOFT,
  }
}
