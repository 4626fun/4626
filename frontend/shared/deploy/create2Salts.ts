import type { Address, Hex } from 'viem'
import { encodePacked, keccak256 } from 'viem'

export const PAYOUT_ROUTER_SALT_TAG = '4626:CreatorPayoutRouter' as const
export const AGENT_REVENUE_ROUTER_SALT_TAG = '4626:AgentRevenueRouter' as const
export const BURN_STREAM_SALT_TAG = '4626:VaultShareBurnStream' as const
export const CREATOR_COIN_POLICY_CONTROLLER_SALT_TAG = '4626:CreatorCoinPolicyController' as const
export const AGENT_REVENUE_POLICY_CONTROLLER_SALT_TAG = '4626:AgentRevenuePolicyController' as const

export type RevenueAuxSaltVaultKind = 'creator' | 'agent'

export function derivePayoutRouterSalt(params: {
  creatorToken: Address
  owner: Address
  vaultKind?: RevenueAuxSaltVaultKind
}): Hex {
  const tag = params.vaultKind === 'agent' ? AGENT_REVENUE_ROUTER_SALT_TAG : PAYOUT_ROUTER_SALT_TAG
  return keccak256(encodePacked(['string', 'address', 'address'], [tag, params.creatorToken, params.owner]))
}

export function deriveVaultShareBurnStreamSalt(params: { creatorToken: Address; owner: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [BURN_STREAM_SALT_TAG, params.creatorToken, params.owner]),
  )
}

export function deriveCreatorCoinPolicyControllerSalt(params: { creatorToken: Address; owner: Address }): Hex {
  return keccak256(
    encodePacked(
      ['string', 'address', 'address'],
      [CREATOR_COIN_POLICY_CONTROLLER_SALT_TAG, params.creatorToken, params.owner],
    ),
  )
}

export function deriveRevenuePolicyControllerSalt(params: {
  creatorToken: Address
  owner: Address
  vaultKind?: RevenueAuxSaltVaultKind
}): Hex {
  const tag =
    params.vaultKind === 'agent'
      ? AGENT_REVENUE_POLICY_CONTROLLER_SALT_TAG
      : CREATOR_COIN_POLICY_CONTROLLER_SALT_TAG
  return keccak256(encodePacked(['string', 'address', 'address'], [tag, params.creatorToken, params.owner]))
}
