import type { Address } from 'viem'

/** Minimal AgentTokenV4 ABI surface for deploy readiness checks. */
export const AGENT_TOKEN_V4_READ_ABI = [
  {
    type: 'function',
    name: 'vault',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'projectTaxRecipient',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'taxAccountingAdapter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'pairToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'uniswapV2Pair',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

export type AgentTokenIntegration = {
  token: Address
  nativeAgentVault: Address | null
  projectTaxRecipient: Address | null
  taxAccountingAdapter: Address | null
  pairToken: Address | null
  uniswapV2Pair: Address | null
}

export type VaultKind = 'creator' | 'agent'

export function isAgentVaultKind(vaultKind: VaultKind | undefined): vaultKind is 'agent' {
  return vaultKind === 'agent'
}
