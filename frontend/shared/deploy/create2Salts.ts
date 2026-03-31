import type { Address, Hex } from 'viem'
import { encodePacked, keccak256 } from 'viem'

export const PAYOUT_ROUTER_SALT_TAG = '4626:PayoutRouter' as const
export const BURN_STREAM_SALT_TAG = '4626:VaultShareBurnStream' as const
export const CREATOR_COIN_POLICY_CONTROLLER_SALT_TAG = '4626:CreatorCoinPolicyController' as const

export function derivePayoutRouterSalt(params: { creatorToken: Address; owner: Address }): Hex {
  return keccak256(
    encodePacked(['string', 'address', 'address'], [PAYOUT_ROUTER_SALT_TAG, params.creatorToken, params.owner]),
  )
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
