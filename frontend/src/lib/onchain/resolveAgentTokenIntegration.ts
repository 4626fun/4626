import type { Address, PublicClient } from 'viem'
import { AGENT_TOKEN_V4_READ_ABI, type AgentTokenIntegration } from './agentTokenIntegration.js'

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

    return {
      token,
      nativeAgentVault: nativeAgentVault.result as Address,
      projectTaxRecipient: projectTaxRecipient.result as Address,
      taxAccountingAdapter: taxAccountingAdapter.result as Address,
      pairToken: pairToken.result as Address,
      uniswapV2Pair: uniswapV2Pair.result as Address,
    }
  } catch {
    return null
  }
}

export function isAgentTokenV4Integration(meta: AgentTokenIntegration | null): meta is AgentTokenIntegration {
  return meta != null && meta.pairToken != null
}
