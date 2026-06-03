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
  tokenNotionalLimitsBaseUnits: Map<string, bigint>
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

const BASE_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const BASE_WETH = '0x4200000000000000000000000000000000000006'

const normalize = (address: string): string => address.toLowerCase()

function tokenLimitDecision(token: string, amount: bigint, config: BaseMcpPolicyConfig): PolicyDecision | null {
  const limit = config.tokenNotionalLimitsBaseUnits.get(normalize(token))
  if (limit === undefined) {
    return {
      status: 'blocked',
      reasonCode: 'policy_notional_too_high',
      message: 'Token has no Base MCP notional limit configured.',
    }
  }
  if (amount > limit) {
    return { status: 'blocked', reasonCode: 'policy_notional_too_high', message: 'Amount exceeds policy token limit.' }
  }
  return null
}

export function createDefaultBaseMcpPolicyConfig(): BaseMcpPolicyConfig {
  return {
    allowedChainIds: [BASE_CHAIN_ID],
    allowedTokens: new Set<string>(),
    blockedRecipients: new Set<string>(['0x0000000000000000000000000000000000000000']),
    // Every allowlisted value-moving token must have a token-specific cap so
    // 6- and 18-decimal assets are never compared against one shared base-unit ceiling.
    tokenNotionalLimitsBaseUnits: new Map<string, bigint>([
      [BASE_USDC, 100_000_000n], // 100 USDC (6 decimals)
      [BASE_WETH, 50_000_000_000_000_000n], // 0.05 WETH (18 decimals)
    ]),
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

  const notionalDecision = tokenLimitDecision(input.sellToken, input.sellAmount, config)
  if (notionalDecision) return notionalDecision

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

  const notionalDecision = tokenLimitDecision(input.token, input.amount, config)
  if (notionalDecision) return notionalDecision

  if (config.blockedRecipients.has(normalize(input.recipient))) {
    return { status: 'blocked', reasonCode: 'policy_recipient_not_allowed', message: 'Recipient is blocked by policy.' }
  }

  return { status: 'ok' }
}
