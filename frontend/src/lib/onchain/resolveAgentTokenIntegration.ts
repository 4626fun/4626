import type { Address, PublicClient } from 'viem'
import { getAddress } from 'viem'

import { BASE_DEFAULTS } from '@/config/contracts.defaults'

import { AGENT_TOKEN_V4_READ_ABI, type AgentTokenIntegration } from './agentTokenIntegration.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const REGISTRY_AGENT_META_ABI = [
  {
    type: 'function',
    name: 'getAgentIntegrationMeta',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'vaultKind', type: 'uint8' },
          { name: 'nativeAgentVault', type: 'address' },
          { name: 'taxRecipient', type: 'address' },
          { name: 'taxAccountingAdapter', type: 'address' },
          { name: 'pairToken', type: 'address' },
          { name: 'uniswapV2Pair', type: 'address' },
        ],
      },
    ],
  },
] as const

type RegistryAgentMeta = {
  vaultKind: number
  nativeAgentVault: Address
  taxRecipient: Address
  taxAccountingAdapter: Address
  pairToken: Address
  uniswapV2Pair: Address
}

function isNonZeroAddress(value: unknown): value is Address {
  return typeof value === 'string' && value !== ZERO_ADDRESS
}

export async function resolveAgentTokenIntegration(
  client: PublicClient,
  token: Address,
): Promise<AgentTokenIntegration | null> {
  try {
    const [nativeAgentVault, projectTaxRecipient, taxAccountingAdapter, pairToken, uniswapV2Pair] =
      await client.multicall({
        contracts: [
          { address: token, abi: AGENT_TOKEN_V4_READ_ABI, functionName: 'vault' },
          { address: token, abi: AGENT_TOKEN_V4_READ_ABI, functionName: 'projectTaxRecipient' },
          { address: token, abi: AGENT_TOKEN_V4_READ_ABI, functionName: 'taxAccountingAdapter' },
          { address: token, abi: AGENT_TOKEN_V4_READ_ABI, functionName: 'pairToken' },
          { address: token, abi: AGENT_TOKEN_V4_READ_ABI, functionName: 'uniswapV2Pair' },
        ],
      })

    const failed = [nativeAgentVault, projectTaxRecipient, taxAccountingAdapter, pairToken, uniswapV2Pair].some(
      (r) => r.status === 'failure',
    )
    if (failed) return null

    const integration = {
      token,
      nativeAgentVault: nativeAgentVault.result as Address,
      projectTaxRecipient: projectTaxRecipient.result as Address,
      taxAccountingAdapter: taxAccountingAdapter.result as Address,
      pairToken: pairToken.result as Address,
      uniswapV2Pair: uniswapV2Pair.result as Address,
    } satisfies AgentTokenIntegration

    if (
      !isNonZeroAddress(integration.nativeAgentVault) ||
      !isNonZeroAddress(integration.projectTaxRecipient) ||
      !isNonZeroAddress(integration.taxAccountingAdapter) ||
      !isNonZeroAddress(integration.pairToken) ||
      !isNonZeroAddress(integration.uniswapV2Pair)
    ) {
      return null
    }

    const registryMeta = (await client.readContract({
      address: getAddress(BASE_DEFAULTS.registry as Address),
      abi: REGISTRY_AGENT_META_ABI,
      functionName: 'getAgentIntegrationMeta',
      args: [token],
    })) as RegistryAgentMeta

    if (
      registryMeta.vaultKind !== 1 ||
      getAddress(registryMeta.nativeAgentVault) !== getAddress(integration.nativeAgentVault) ||
      getAddress(registryMeta.taxRecipient) !== getAddress(integration.projectTaxRecipient) ||
      getAddress(registryMeta.taxAccountingAdapter) !== getAddress(integration.taxAccountingAdapter) ||
      getAddress(registryMeta.pairToken) !== getAddress(integration.pairToken) ||
      getAddress(registryMeta.uniswapV2Pair) !== getAddress(integration.uniswapV2Pair)
    ) {
      return null
    }

    return integration
  } catch {
    return null
  }
}

export function isAgentTokenV4Integration(meta: AgentTokenIntegration | null): meta is AgentTokenIntegration {
  return meta != null && meta.pairToken != null
}
