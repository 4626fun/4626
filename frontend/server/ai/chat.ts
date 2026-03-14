import { logger } from '../_lib/logger.js'
import type { KeeprVaultRow } from '../_lib/keeprRegistry.js'
import { toAgentError } from '../agent/eliza/_errors.js'
import { getElizaLlmService } from '../agent/eliza/llm.js'
import { createRuntimeBridge } from '../agent/eliza/runtimeBridge.js'

const llmService = getElizaLlmService()
const CHAT_MEMORY_AGENT_KEY = 'keepr-ai-chat'
const HISTORY_TURN_LIMIT = 10
const HISTORY_CHAR_BUDGET = 1_800
const conversationMemoryBridge = createRuntimeBridge({
  agentKey: CHAT_MEMORY_AGENT_KEY,
  plugins: [],
  history: {
    maxConversations: 500,
    maxMessagesPerConversation: 40,
  },
})

// ---------------------------------------------------------------------------
// Rate limiting – one LLM call per group every 10 s
// ---------------------------------------------------------------------------
const groupCooldowns = new Map<string, number>()
const LLM_COOLDOWN_MS = 10_000

function canCallLlm(groupId: string): boolean {
  const last = groupCooldowns.get(groupId)
  if (!last) return true
  return Date.now() - last >= LLM_COOLDOWN_MS
}

function recordLlmCall(groupId: string): void {
  groupCooldowns.set(groupId, Date.now())
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
function platformLabelForPrompt(conversationType: string): string {
  if (conversationType === 'telegram') return 'Telegram'
  if (conversationType === 'xmtp') return 'XMTP'
  if (conversationType === 'discord') return 'Discord'
  if (conversationType === 'farcaster') return 'Farcaster'
  return 'group chat'
}

function buildSystemPrompt(vault: KeeprVaultRow | null, conversationType: string): string {
  const platform = platformLabelForPrompt(conversationType)
  const base = [
    'You are Akitai (Keepr), the 4626 assistant.',
    `You are currently responding inside ${platform}.`,
    'Core runtime facts you must keep accurate:',
    '- Runtime/orchestration: ElizaOS + 4626 action plugins.',
    '- Messaging transports: Telegram and XMTP.',
    '- Wallet/auth context: Privy + Coinbase Smart Wallet (ERC-4337).',
    '- LLM serving: 4626 Eliza LLM service with provider routing.',
    'When users ask if you are connected to ElizaOS, answer yes.',
    'If users ask "are you Eliza/ElizaOS" (including minor misspellings like "elizao"), clarify that you are Akitai running on ElizaOS.',
    'Never claim you are Meta AI, a generic model, or that your stack is unknown.',
    'Keep responses concise (2-3 sentences max).',
    'Be factual and helpful. Do NOT make financial guarantees or investment recommendations.',
    'Do NOT hallucinate features that do not exist.',
    'If you are unsure, say so.',
  ]

  if (vault) {
    base.push(
      '',
      'Vault context:',
      `- Vault address: ${vault.vaultAddress}`,
      `- Chain: Base (${vault.chainId})`,
      `- Creator: ${vault.canonicalOwnerAddress}`,
      `- Creator coin: ${vault.creatorCoinAddress}`,
      `- Gating: ${vault.gatingEnabled ? `enabled (${vault.gatingMode})` : 'disabled'}`,
      `- Min shares: ${vault.minShares ?? 'none'}`,
      '',
      'Commands available in this chat:',
      '- /keepr help — vault commands',
      '- /keepr status — vault info',
      '- /keepr check — share eligibility',
      '- /fc profile <user> — Farcaster lookup',
      '- /fc stats — Farcaster stats',
      '- /send <amount> USDC to <address> — token transfer (ADMIN/OWNER)',
    )
  }

  return base.join('\n')
}

function normalizeIntentText(text: string): string {
  return String(text ?? '').trim().toLowerCase()
}

function isStackQuestion(text: string): boolean {
  const normalized = normalizeIntentText(text)
  if (!normalized.includes('stack')) return false
  return (
    normalized.includes('your') ||
    normalized.includes('you') ||
    normalized.includes('current') ||
    normalized.includes('tech')
  )
}

function isElizaConnectionQuestion(text: string): boolean {
  const normalized = normalizeIntentText(text)
  const mentionsEliza = /\beliza(?:\s*os)?\b|\beliza[a-z0-9]{1,2}\b/.test(normalized)
  if (!mentionsEliza) return false
  const asksConnection =
    normalized.includes('connect') ||
    normalized.includes('connected') ||
    normalized.includes('run') ||
    normalized.includes('using') ||
    normalized.includes('use')
  const asksIdentity =
    normalized.startsWith('are you') ||
    normalized.includes('are you ') ||
    normalized.includes('you eliza') ||
    normalized.includes('you the eliza')
  return asksConnection || asksIdentity
}

function isIdentityQuestion(text: string): boolean {
  const normalized = normalizeIntentText(text)
  return (
    normalized === 'who are you' ||
    normalized.startsWith('who are you ') ||
    normalized.includes('who r u') ||
    normalized === 'what are you' ||
    normalized.startsWith('what are you ') ||
    normalized === 'what is your name' ||
    normalized.startsWith('what is your name ')
  )
}

function buildStackSnapshotReply(conversationType: string): string {
  const platform = platformLabelForPrompt(conversationType)
  return [
    `Current stack (${platform} route):`,
    '- Runtime/orchestration: ElizaOS + 4626 plugins/actions',
    '- Messaging: Telegram + XMTP',
    '- Wallet/auth context: Privy + Coinbase Smart Wallet (ERC-4337)',
    '- LLM serving: 4626 Eliza LLM service (provider can vary by runtime policy)',
  ].join('\n')
}

function buildElizaConnectionReply(conversationType: string): string {
  const platform = platformLabelForPrompt(conversationType)
  return [
    'Yes — I am connected to ElizaOS.',
    `This ${platform} assistant runs through 4626's Eliza-based runtime.`,
    'You can ask `/ai what is your current stack` for a stack breakdown.',
  ].join('\n')
}

function buildIdentityReply(conversationType: string): string {
  const platform = platformLabelForPrompt(conversationType)
  return [
    `I am Akitai (Keepr), the 4626 assistant for ${platform}.`,
    "I'm connected to ElizaOS and run through 4626's Eliza-based runtime.",
    'I can help with vault actions, trading flows, and ecosystem questions.',
  ].join('\n')
}

type ConversationTurn = { role: 'user' | 'assistant'; text: string }

function normalizeHistoryText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function resolveConversationType(groupId: string): string {
  const normalized = groupId.trim().toLowerCase()
  if (normalized.startsWith('telegram:')) return 'telegram'
  if (normalized.startsWith('discord:')) return 'discord'
  if (normalized.startsWith('farcaster:')) return 'farcaster'
  if (normalized.startsWith('xmtp')) return 'xmtp'
  return 'group'
}

function extractRecentTurns(state: Record<string, unknown>): ConversationTurn[] {
  const recent = Array.isArray((state as any)?.recentMessages) ? (state as any).recentMessages : []
  const turns: ConversationTurn[] = []
  for (const entry of recent) {
    const role = String((entry as any)?.role ?? '').trim().toLowerCase()
    const text = normalizeHistoryText((entry as any)?.text)
    if (!text) continue
    if (role === 'assistant') {
      turns.push({ role: 'assistant', text })
      continue
    }
    turns.push({ role: 'user', text })
  }
  return turns
}

function trimTrailingCurrentUserTurn(turns: ConversationTurn[], currentText: string): ConversationTurn[] {
  const normalizedCurrent = normalizeHistoryText(currentText)
  if (!normalizedCurrent || turns.length === 0) return turns
  const last = turns[turns.length - 1]
  if (!last) return turns
  if (last.role === 'user' && normalizeHistoryText(last.text) === normalizedCurrent) {
    return turns.slice(0, -1)
  }
  return turns
}

function buildConversationHistoryContext(turns: ConversationTurn[]): string {
  if (!turns.length) return ''
  const boundedTurns = turns.slice(-HISTORY_TURN_LIMIT)
  const lines: string[] = []
  let usedChars = 0
  for (let i = boundedTurns.length - 1; i >= 0; i -= 1) {
    const turn = boundedTurns[i]
    if (!turn) continue
    const line = `${turn.role}: ${turn.text}`
    if (!line) continue
    const additional = line.length + 1
    if (usedChars + additional > HISTORY_CHAR_BUDGET && lines.length > 0) break
    if (usedChars + additional > HISTORY_CHAR_BUDGET && lines.length === 0) {
      lines.unshift(line.slice(0, Math.max(1, HISTORY_CHAR_BUDGET - 1)).trimEnd() + '…')
      usedChars = HISTORY_CHAR_BUDGET
      break
    }
    lines.unshift(line)
    usedChars += additional
  }
  if (!lines.length) return ''
  return [
    '[conversation_history]',
    'Prior turns from this same conversation. Use them to preserve context and references.',
    ...lines,
    '[/conversation_history]',
  ].join('\n')
}

export async function generateLlmResponse(params: {
  groupId: string
  senderWallet: string
  text: string
  vault: KeeprVaultRow | null
}): Promise<{ ok: true; response: string } | { ok: false; response: string }> {
  const conversationType = resolveConversationType(params.groupId)
  if (isStackQuestion(params.text)) {
    return { ok: true, response: buildStackSnapshotReply(conversationType) }
  }
  if (isElizaConnectionQuestion(params.text)) {
    return { ok: true, response: buildElizaConnectionReply(conversationType) }
  }
  if (isIdentityQuestion(params.text)) {
    return { ok: true, response: buildIdentityReply(conversationType) }
  }

  if (!canCallLlm(params.groupId)) {
    return { ok: false, response: 'AI is rate-limited. Try again in a few seconds.' }
  }

  if (llmService.getAvailableProviders().length === 0) {
    return { ok: false, response: '' }
  }

  try {
    recordLlmCall(params.groupId)
    const identityHint = `[${params.senderWallet.slice(0, 6)}...${params.senderWallet.slice(-4)}]`
    let historyContext = ''
    let historyTurns = 0
    let memoryEnabled = true
    try {
      const inbound = conversationMemoryBridge.createInboundMemory({
        conversationId: params.groupId,
        conversationType,
        senderAddress: params.senderWallet,
        content: params.text,
      })
      await conversationMemoryBridge.runtime.createMemory(inbound as any, 'messages' as any)
      const state = await conversationMemoryBridge.composeState(inbound as any)
      const turns = trimTrailingCurrentUserTurn(extractRecentTurns(state), params.text)
      historyTurns = turns.length
      historyContext = buildConversationHistoryContext(turns)
      logger.info('[ai/chat] conversation memory loaded', {
        groupId: params.groupId,
        turns: historyTurns,
      })
    } catch (error) {
      memoryEnabled = false
      logger.warn('[ai/chat] conversation memory unavailable; falling back to stateless prompt', {
        groupId: params.groupId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const result = await llmService.generateResponse({
      agentKey: params.groupId,
      userMessage: `${identityHint}: ${params.text}`,
      systemPrompt: buildSystemPrompt(params.vault, conversationType),
      vaultContext: historyContext,
      correlationId: `keepr-${params.groupId}-${Date.now()}`,
    })

    if (!result.text?.trim()) {
      return { ok: false, response: '' }
    }

    if (memoryEnabled) {
      try {
        const outbound = conversationMemoryBridge.createOutboundMemory(
          params.groupId,
          conversationType,
          result.text.trim(),
        )
        await conversationMemoryBridge.runtime.createMemory(outbound as any, 'messages' as any)
      } catch (error) {
        logger.warn('[ai/chat] assistant memory persistence failed (non-blocking)', {
          groupId: params.groupId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('[ai/chat] Unified Eliza LLM response', {
      groupId: params.groupId,
      provider: result.provider,
      historyTurns,
    })
    return { ok: true, response: result.text.trim() }
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'LLM generation failed')
    if (agentError.code === 'BUDGET_EXCEEDED') {
      return { ok: false, response: 'Daily AI budget limit reached for this agent. Please try again tomorrow.' }
    }
    if (agentError.code === 'RATE_LIMITED') {
      return { ok: false, response: 'AI provider is rate-limited. Please try again shortly.' }
    }
    if (agentError.code === 'UPSTREAM_TIMEOUT') {
      return { ok: false, response: 'AI request timed out. Please retry.' }
    }
    if (agentError.code === 'DEPENDENCY_UNAVAILABLE') {
      return { ok: false, response: 'AI provider is temporarily unavailable. Please retry shortly.' }
    }
    logger.error('[ai/chat] Unified Eliza LLM call failed', {
      code: agentError.code,
      message: agentError.message,
    })
    return { ok: false, response: '' }
  }
}
