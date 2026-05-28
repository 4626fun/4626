import { BASE_CHAIN_ID } from './schemas'

export type PolicyReasonCode =
  | 'not_execution_ready'
  | 'policy_token_not_allowed'
  | 'policy_slippage_too_high'
  | 'policy_notional_too_high'
  | 'policy_chain_not_allowed'
  | 'policy_recipient_not_allowed'

export type PolicyDecision =
  | { status: 'ok' }
  | { status: 'blocked'; reasonCode: PolicyReasonCode; message: string }

export interface BaseMcpPolicyConfig {
  allowedChainIds: number[]
  allowedTokens: Set<string>
  blockedRecipients: Set<string>
  maxNotionalBaseUnits: bigint
  maxSlippageBps: number
}

export interface SwapPolicyInput {
  chainId: number
  sellToken: string
  buyToken: string
  sellAmount: bigint
  maxSlippageBps: number
}

export interface TransferPolicyInput {
  chainId: number
  token: string
  amount: bigint
  recipient: string
}

const normalize = (address: string): string => address.toLowerCase()

export function createDefaultBaseMcpPolicyConfig(): BaseMcpPolicyConfig {
  return {
    allowedChainIds: [BASE_CHAIN_ID],
    allowedTokens: new Set<string>(),
    blockedRecipients: new Set<string>(['0x0000000000000000000000000000000000000000']),
    maxNotionalBaseUnits: 10_000_000n,
    maxSlippageBps: 100,
  }
}

export function evaluateSwapPolicy(input: SwapPolicyInput, config: BaseMcpPolicyConfig): PolicyDecision {
  if (!config.allowedChainIds.includes(input.chainId)) {
    return { status: 'blocked', reasonCode: 'policy_chain_not_allowed', message: 'Chain is not allowed for Base MCP swap actions.' }
  }

  if (!config.allowedTokens.has(normalize(input.sellToken)) || !config.allowedTokens.has(normalize(input.buyToken))) {
    return { status: 'blocked', reasonCode: 'policy_token_not_allowed', message: 'Swap token is not in the allowlist.' }
  }

  if (input.sellAmount > config.maxNotionalBaseUnits) {
    return { status: 'blocked', reasonCode: 'policy_notional_too_high', message: 'Swap amount exceeds policy notional limit.' }
  }

  if (input.maxSlippageBps > config.maxSlippageBps) {
    return { status: 'blocked', reasonCode: 'policy_slippage_too_high', message: 'Requested slippage exceeds policy limit.' }
  }

  return { status: 'ok' }
}

export function evaluateTransferPolicy(input: TransferPolicyInput, config: BaseMcpPolicyConfig): PolicyDecision {
  if (!config.allowedChainIds.includes(input.chainId)) {
    return { status: 'blocked', reasonCode: 'policy_chain_not_allowed', message: 'Chain is not allowed for Base MCP transfer actions.' }
  }

  if (!config.allowedTokens.has(normalize(input.token))) {
    return { status: 'blocked', reasonCode: 'policy_token_not_allowed', message: 'Transfer token is not in the allowlist.' }
  }

  if (input.amount > config.maxNotionalBaseUnits) {
    return { status: 'blocked', reasonCode: 'policy_notional_too_high', message: 'Transfer amount exceeds policy notional limit.' }
  }

  if (config.blockedRecipients.has(normalize(input.recipient))) {
    return { status: 'blocked', reasonCode: 'policy_recipient_not_allowed', message: 'Recipient is blocked by policy.' }
  }

  return { status: 'ok' }
}
