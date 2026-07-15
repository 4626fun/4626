import type {
  DecisionTerminalOutcome,
  TerminalReplyDecision,
  TerminalReplyDeliveryKind,
} from './inverseOpinionTradeStore.js'

export type TerminalReplyPayload = {
  kind: TerminalReplyDeliveryKind
  publicText: string
  clientMessageId: string
}

function boundedText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text && text.length <= 2_000 ? text : null
}

export function formatInverseOpinionSkipReply(reasonCode: string): string | null {
  switch (reasonCode) {
    case 'reaction_disabled':
    case 'arena_trading_disabled':
      return 'wanted to invert your take but arena trading is off on the server. operator skill issue.'
    case 'missing_executor_wallet':
    case 'executor_identity_unavailable':
      return 'wanted to invert your take but InverseAKITA has no executor wallet mapped yet.'
    case 'insufficient_stake':
      return 'wanted to invert your take, but this pilot requires the room 1659 stake gate.'
    case 'stake_read_failed':
    case 'authority_check_failed':
      return 'wanted to invert your take but the room 1659 stake check failed. retry in a moment.'
    case 'arena_room_blocked':
      return 'wanted to invert your take but this room is not on the arena allowlist.'
    case 'market_metadata_unavailable':
      return 'wanted to invert your take but Hyperliquid market metadata is unavailable. retry in a moment.'
    case 'market_not_listed':
      return 'wanted to invert your take but that market is not currently listed on Hyperliquid.'
    case 'market_ambiguous':
      return 'wanted to invert your take but could not safely identify the market. please name the exact ticker.'
    case 'sender_cooldown':
      return 'wanted to invert your take but the execution cooldown is still active. retry shortly.'
    default:
      if (reasonCode.startsWith('pair_') || reasonCode.includes('allowlist')) {
        return `wanted to invert your take but that pair is blocked here (${reasonCode}).`
      }
      return null
  }
}

function safeTerminalExplanation(outcome: DecisionTerminalOutcome): string {
  if (outcome === 'executed') {
    return 'the inverse trade execution was confirmed, but its detailed receipt is unavailable.'
  }
  if (outcome === 'failed') {
    return 'the inverse trade attempt failed; no successful execution is being claimed.'
  }
  if (outcome === 'incomplete') {
    return 'the inverse trade outcome could not be confirmed; no successful execution is being claimed.'
  }
  return 'the inverse trade was not executed because its persisted decision could not be completed safely.'
}

export function buildTerminalReplyPayloads(
  decision: TerminalReplyDecision,
): TerminalReplyPayload[] {
  const terminalReply = decision.receiptSummary.terminalReply
  const persisted = terminalReply && typeof terminalReply === 'object' && !Array.isArray(terminalReply)
    ? terminalReply as Record<string, unknown>
    : null
  let resultText: string | null = null
  let receiptText: string | null = null

  if (decision.terminalOutcome === 'executed' || decision.terminalOutcome === 'failed') {
    resultText = boundedText(persisted?.replyText)
    receiptText = boundedText(persisted?.threadReceiptText)
    if (!resultText) resultText = safeTerminalExplanation(decision.terminalOutcome)
  } else if (
    decision.terminalOutcome === 'rejected'
    || decision.terminalOutcome === 'blocked'
  ) {
    resultText = formatInverseOpinionSkipReply(decision.reasonCode ?? '')
      ?? safeTerminalExplanation(decision.terminalOutcome)
  } else {
    resultText = safeTerminalExplanation(decision.terminalOutcome)
  }

  return [
    {
      kind: 'result',
      publicText: resultText,
      clientMessageId: `inverse-opinion:${decision.decisionId}:result`,
    },
    ...(receiptText
      ? [{
          kind: 'receipt' as const,
          publicText: receiptText,
          clientMessageId: `inverse-opinion:${decision.decisionId}:receipt`,
        }]
      : []),
  ]
}
