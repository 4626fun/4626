import { logger } from '../_lib/logger.js'
import type { KeeprVaultRow } from '../_lib/keeprRegistry.js'
import { isHandledConversationalSlashPrefix, normalizeConversationalPrompt } from '../agent/core/conversationalInput.js'
import { toAgentError } from '../agent/eliza/_errors.js'
import { parsePositiveNumber } from '../agent/eliza/_rateLimit.js'
import { withRetry, withTimeout } from '../agent/eliza/_retry.js'
import { getActionRetryBudget } from '../agent/eliza/_runtimePolicy.js'
import { buildContinuityContextBlock } from '../agent/eliza/_stateHelpers.js'
import { resolveCharacterRuntimeConfig } from '../agent/eliza/character.js'
import { getElizaLlmService } from '../agent/eliza/llm.js'
import { createRuntimeBridge } from '../agent/eliza/runtimeBridge.js'
import {
  hasVerifiedMemoryContinuity,
  resolveAssistantRuntimeTruth,
  type AssistantRuntimeTruth,
  type AssistantRuntimeTruthInput,
} from './runtimeTruth.js'

const llmService = getElizaLlmService()
const CHAT_MEMORY_AGENT_KEY = 'keepr-ai-chat'
export type ChatRuntimeBridge = ReturnType<typeof createRuntimeBridge>
export type SharedConversationalRuntimeContext = {
  runtimeBridge: ChatRuntimeBridge
  inboundMemory: unknown
  state: Record<string, unknown>
}

type ChatRuntimeContext = {
  bridge: ChatRuntimeBridge
  contextProviders: Array<{
    name?: string
    get: (runtime: unknown, memory: unknown, state: unknown) => Promise<{ text?: string } | null | undefined>
  }>
  characterConfig: { systemPrompt: string; preferredModel: string }
}

const ACTION_TIMEOUT_MS = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_ACTION_TIMEOUT_MS, 30_000))
const ACTION_MAX_CANDIDATES = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_ACTION_MAX_CANDIDATES, 2))
const ACTION_MAX_RETRIES = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_ACTION_MAX_RETRIES, 2))
const EXTERNAL_MAX_RETRIES = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_EXTERNAL_MAX_RETRIES, 2))
const MAX_INBOUND_MESSAGE_CHARS = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_MAX_INBOUND_CHARS, 4_000))
const LLM_COOLDOWN_MS = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_LLM_COOLDOWN_MS, 10_000))

const groupCooldowns = new Map<string, number>()

function canCallLlm(groupId: string): boolean {
  const last = groupCooldowns.get(groupId)
  if (!last) return true
  return Date.now() - last >= LLM_COOLDOWN_MS
}

function recordLlmCall(groupId: string): void {
  groupCooldowns.set(groupId, Date.now())
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
function platformLabelForPrompt(conversationType: string): string {
  if (conversationType === 'telegram') return 'Telegram'
  if (conversationType === 'xmtp') return 'XMTP'
  if (conversationType === 'discord') return 'Discord'
  if (conversationType === 'web') return 'web app chat'
  return 'group chat'
}

function buildSystemPrompt(
  vault: KeeprVaultRow | null,
  conversationType: string,
  runtimeTruth: AssistantRuntimeTruth,
): string {
  const platform = platformLabelForPrompt(conversationType)
  const base = [
    'You are Akitai (Keepr), the 4626 assistant.',
    `You are currently responding inside ${platform}.`,
    'Core runtime facts you must keep accurate:',
    '- Runtime/orchestration (configured stack): ElizaOS + 4626 action plugins.',
    `- ElizaOS connection (current runtime): ${runtimeTruth.isElizaConnected ? 'verified' : 'unverified'}.`,
    '- Messaging transports: Telegram and XMTP.',
    '- Wallet/auth context: Privy + Coinbase Smart Wallet (ERC-4337).',
    '- LLM serving: 4626 Eliza LLM service with provider routing.',
    `- Conversation memory (current runtime): ${hasVerifiedMemoryContinuity(runtimeTruth) ? 'verified available' : 'not verified available'}.`,
    `- Vault deployment context (trusted source): ${runtimeTruth.hasVerifiedDeploymentFlow ? String(runtimeTruth.deploymentFlowSource ?? 'app_state') : 'unverified'}.`,
    'Only claim live ElizaOS connection when runtime verification is true.',
    'Only claim memory continuity when current-conversation memory/session storage is verified available.',
    'Only describe exact vault deployment steps when they are present in trusted app state, docs, config, or backend responses.',
    'Prefer continuity by using provided <conversation_history>, <memory_snapshot>, <fact_cards>, <open_tasks>, and <semantic_recall> blocks.',
    'If users ask "are you Eliza/ElizaOS" (including minor misspellings like "elizao"), clarify that you are Akitai and report ElizaOS connection status truthfully.',
    'Never claim you are Meta AI or a different assistant identity.',
    'Keep responses concise (2-3 sentences max).',
    'Be factual and helpful. Do NOT make financial guarantees or investment recommendations.',
    'Do NOT hallucinate features that do not exist.',
    'If you are unsure, say so.',
    'Use provided conversation history context when available to maintain continuity.',
    'When asked about memory, explain that you can reference prior turns from this conversation context.',
    'Do not claim "I cannot remember previous messages" if conversation history in this thread is available.',
    'Be explicit that continuity may be limited outside this conversation context.',
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
      '- /send <amount> USDC to <address> — token transfer (ADMIN/OWNER)',
    )
  }

  return base.join('\n')
}

function normalizeIntentText(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type IdentityIntent = 'stack' | 'eliza' | 'memory' | 'vault_deployment' | 'identity' | null

function classifyIdentityIntent(text: string): IdentityIntent {
  const normalized = normalizeIntentText(text)
  if (!normalized) return null

  const mentionsStack = /\bstack\b/.test(normalized)
  const mentionsEliza = /\beliza(?:\s*os)?\b|\beliza[a-z0-9]{1,3}\b/.test(normalized)
  const mentionsMemory = /\b(memory|remember|recall|context)\b/.test(normalized)
  const mentionsPersistence = /\b(persistent|persist|across|between|session|sessions|retain|store|saved|save)\b/.test(normalized)
  const asksVaultDeploymentFlow =
    /\bvault\b/.test(normalized) &&
    /\b(deploy|deployment|launch|setup|phase|phases)\b/.test(normalized) &&
    /\b(how|flow|steps?|process|walkthrough|walk through|explain|what)\b/.test(normalized)
  const asksWho =
    /\bwho(?:mst)?\s+are\s+you\b/.test(normalized) ||
    /\bwhat\s+are\s+you\b/.test(normalized) ||
    /\bwhat\s+is\s+your\s+name\b/.test(normalized)
  const asksConnection =
    /\bconnect(?:ed|ion)?\b/.test(normalized) ||
    /\brun(?:ning)?\b/.test(normalized) ||
    /\busing\b/.test(normalized) ||
    /\buse\b/.test(normalized) ||
    /\bare\s+you\b/.test(normalized)

  if (mentionsMemory && (mentionsPersistence || mentionsEliza || /\bi thought\b|\ballowed\b/.test(normalized))) {
    return 'memory'
  }
  if (asksVaultDeploymentFlow) {
    return 'vault_deployment'
  }
  if (mentionsStack && /\b(your|you|current|tech|what|tell)\b/.test(normalized)) {
    return 'stack'
  }
  if (mentionsEliza && asksConnection) {
    return 'eliza'
  }
  if (asksWho) {
    return 'identity'
  }
  return null
}

function buildStackSnapshotReply(conversationType: string, runtimeTruth: AssistantRuntimeTruth): string {
  const platform = platformLabelForPrompt(conversationType)
  return [
    `Current stack (${platform} route):`,
    '- Runtime/orchestration (configured): ElizaOS + 4626 plugins/actions',
    `- ElizaOS connection status: ${runtimeTruth.isElizaConnected ? 'verified in current runtime' : 'unverified in current runtime'}`,
    '- Messaging: Telegram + XMTP',
    '- Wallet/auth context: Privy + Coinbase Smart Wallet (ERC-4337)',
    '- LLM serving: 4626 Eliza LLM service (provider can vary by runtime policy)',
  ].join('\n')
}

function buildElizaConnectionReply(conversationType: string, runtimeTruth: AssistantRuntimeTruth): string {
  const platform = platformLabelForPrompt(conversationType)
  if (!runtimeTruth.isElizaConnected) {
    return [
      "I may be running in a simulated or app-managed environment, and I can't verify a live ElizaOS connection from the current runtime.",
      `I can still help in this ${platform} chat with the context currently available.`,
    ].join('\n')
  }
  return [
    'Yes — runtime state verifies an active ElizaOS connection.',
    `This ${platform} assistant is currently running through 4626's Eliza-based runtime.`,
    'You can ask `/ai what is your current stack` for a stack breakdown.',
  ].join('\n')
}

function buildIdentityReply(conversationType: string, runtimeTruth: AssistantRuntimeTruth): string {
  const platform = platformLabelForPrompt(conversationType)
  const runtimeLine = runtimeTruth.isElizaConnected
    ? "Runtime status: ElizaOS connection is verified for this assistant context."
    : "Runtime status: ElizaOS connection is not verified from the current runtime."
  return [
    `I am Akitai (Keepr), the 4626 assistant for ${platform}.`,
    runtimeLine,
    'I can help with vault actions, trading flows, and ecosystem questions.',
  ].join('\n')
}

function buildMemoryReply(conversationType: string, runtimeTruth: AssistantRuntimeTruth): string {
  const platform = platformLabelForPrompt(conversationType)
  if (!hasVerifiedMemoryContinuity(runtimeTruth)) {
    return [
      'I only have access to the current chat context unless persistent memory is enabled and available.',
      `For this ${platform} chat, I can continue with what is visible in the current thread.`,
    ].join('\n')
  }
  return [
    `Yes — I keep memory for this ${platform} conversation.`,
    'I retain recent turns plus summarized facts/tasks, and can restore older context when storage is available.',
    "Memory is scoped per conversation, so I don't mix context from unrelated chats.",
  ].join('\n')
}

function buildVaultDeploymentReply(runtimeTruth: AssistantRuntimeTruth): string {
  if (!runtimeTruth.hasVerifiedDeploymentFlow || !runtimeTruth.deploymentFlowSummary) {
    return "I can describe the intended high-level flow, but I can't verify the exact in-app deployment steps from the current context."
  }
  return `From verified ${runtimeTruth.deploymentFlowSource ?? 'app_state'} context: ${runtimeTruth.deploymentFlowSummary}`
}

function buildRuntimeUnavailableFallback(conversationType: string): string {
  const platform = platformLabelForPrompt(conversationType)
  return [
    "I may be running in a simulated or app-managed environment, and I can't verify a live ElizaOS connection from the current runtime.",
    `I can still help with bounded answers in this ${platform} chat, but runtime-backed actions are temporarily unavailable.`,
  ].join('\n')
}

type ConversationTurn = { role: 'user' | 'assistant'; text: string }

let runtimeContextPromise: Promise<ChatRuntimeContext> | null = null

async function getChatRuntimeContext(): Promise<ChatRuntimeContext> {
  if (runtimeContextPromise) return runtimeContextPromise
  runtimeContextPromise = (async () => {
    const [
      { keeprPlugin },
      { zoraPlugin },
      { uniswapPlugin },
      { bankrPlugin },
      { lensPlugin },
      { walletIntelPlugin },
      { reputationPlugin },
      { crePlugin },
      { knowledgePlugin },
    ] = await Promise.all([
      import('../agent/eliza/plugins/keepr/index.js'),
      import('../agent/eliza/plugins/zora/index.js'),
      import('../agent/eliza/plugins/uniswap/index.js'),
      import('../agent/eliza/plugins/bankr/index.js'),
      import('../agent/eliza/plugins/lens/index.js'),
      import('../agent/eliza/plugins/walletIntel/index.js'),
      import('../agent/eliza/plugins/reputation/index.js'),
      import('../agent/eliza/plugins/cre/index.js'),
      import('../agent/eliza/plugins/knowledge/index.js'),
    ])
    const characterRuntimeConfig = resolveCharacterRuntimeConfig()
    const plugins = [
      keeprPlugin,
      zoraPlugin,
      uniswapPlugin,
      bankrPlugin,
      lensPlugin,
      walletIntelPlugin,
      reputationPlugin,
      crePlugin,
      knowledgePlugin,
    ]
    const bridge = createRuntimeBridge({
      agentKey: CHAT_MEMORY_AGENT_KEY,
      plugins,
      settings: characterRuntimeConfig.settings,
      character: {
        systemPrompt: characterRuntimeConfig.systemPrompt,
        preferredModel: characterRuntimeConfig.preferredModel,
      },
      history: {
        maxConversations: 500,
        maxMessagesPerConversation: 40,
      },
    })
    const contextProviders: ChatRuntimeContext['contextProviders'] = [
      ...(keeprPlugin.providers ?? []),
      ...(knowledgePlugin.providers ?? []),
    ] as ChatRuntimeContext['contextProviders']
    return {
      bridge,
      contextProviders,
      characterConfig: {
        systemPrompt: characterRuntimeConfig.systemPrompt,
        preferredModel: characterRuntimeConfig.preferredModel ?? '',
      },
    }
  })().catch((error) => {
    runtimeContextPromise = null
    throw error
  })
  return runtimeContextPromise as Promise<ChatRuntimeContext>
}

// ---------------------------------------------------------------------------
// Request normalization helpers (kept from original chat.ts)
// ---------------------------------------------------------------------------

function resolveConversationType(groupId: string): string {
  const normalized = groupId.trim().toLowerCase()
  if (normalized.startsWith('telegram:')) return 'telegram'
  if (normalized.startsWith('discord:')) return 'discord'
  if (normalized.startsWith('xmtp')) return 'xmtp'
  if (normalized.startsWith('web:') || normalized.startsWith('app:') || normalized.startsWith('chat:')) return 'web'
  return 'group'
}

function resolveConversationSource(conversationType: string): string {
  if (conversationType === 'web') return 'web'
  if (conversationType === 'xmtp') return 'xmtp'
  if (conversationType === 'telegram') return 'telegram'
  if (conversationType === 'discord') return 'discord'
  return 'app'
}

function toSenderAddress(senderWallet: string): string | null {
  const normalized = String(senderWallet ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null
  return normalized
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

function normalizeHistoryText(text: unknown): string {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimTrailingCurrentUserTurn(turns: ConversationTurn[], userText: string): ConversationTurn[] {
  if (turns.length === 0) return turns
  const last = turns[turns.length - 1]
  if (last.role !== 'user') return turns
  const nLast = normalizeHistoryText(last.text)
  const nUser = normalizeHistoryText(userText)
  if (nLast && nUser && nLast === nUser) return turns.slice(0, -1)
  return turns
}

function buildStructuredMemoryContext(state: Record<string, unknown>): string {
  const parts: string[] = []
  const snap = String((state as any)?.memorySnapshotBlock ?? '').trim()
  const facts = String((state as any)?.factCardsBlock ?? '').trim()
  const tasks = String((state as any)?.openTasksBlock ?? '').trim()
  const semantic = String((state as any)?.semanticRecallBlock ?? '').trim()
  if (snap) parts.push(snap)
  if (facts) parts.push(facts)
  if (tasks) parts.push(tasks)
  if (semantic) parts.push(semantic)
  return parts.join('\n\n')
}

function isLikelyIdentityDrift(text: string): boolean {
  const t = String(text ?? '').toLowerCase()
  if (!t) return false
  if (/\bmeta\s+ai\b/.test(t)) return true
  if (/\b(claude|chatgpt|gpt-4|openai)\b/.test(t)) return true
  if (/\bi\s+am\s+(an|the)\s+ai\b/.test(t)) return true
  if (/\bi\s+am\s+(an|the)\s+assistant\b/.test(t) && !/\bakitai\b/.test(t)) return true
  return false
}

// ---------------------------------------------------------------------------
// generateLlmResponse — thin adapter into the Eliza runtime pipeline
// ---------------------------------------------------------------------------

export async function generateLlmResponse(params: {
  groupId: string
  senderWallet: string
  text: string
  vault: KeeprVaultRow | null
  runtimeTruth?: AssistantRuntimeTruthInput
  runtimeContext?: SharedConversationalRuntimeContext
  allowActionExecution?: boolean
}): Promise<
  | { ok: true; response: string; handledByRuntime: boolean }
  | { ok: false; response: string; handledByRuntime: boolean }
> {
  const conversationType = resolveConversationType(params.groupId)
  const conversationSource = resolveConversationSource(conversationType)
  const rawText = String(params.text ?? '').trim()
  const normalizedPrompt = normalizeConversationalPrompt(params.text)
  const userText = normalizedPrompt || rawText
  let runtimeTruth = resolveAssistantRuntimeTruth(params.runtimeTruth)
  const identityIntent = classifyIdentityIntent(userText)
  const allowActionExecution = params.allowActionExecution !== false

  if (!userText.trim()) {
    return { ok: true, response: buildIdentityReply(conversationType, runtimeTruth), handledByRuntime: true }
  }

  if (rawText.startsWith('/') && !isHandledConversationalSlashPrefix(rawText)) {
    return { ok: true, response: buildIdentityReply(conversationType, runtimeTruth), handledByRuntime: true }
  }

  let runtimeBridge: ChatRuntimeBridge | null = null
  let handledByRuntime = false
  let historyTurns = 0
  let actionReply = ''
  let state: Record<string, unknown> = {}
  let stateForContinuity: Record<string, unknown> = {}
  let inbound: any = null

  try {
    const senderAddress = toSenderAddress(params.senderWallet)
    if (params.runtimeContext) {
      runtimeBridge = params.runtimeContext.runtimeBridge
      inbound = params.runtimeContext.inboundMemory
      state = params.runtimeContext.state
      handledByRuntime = true
    } else {
      const ctx = await getChatRuntimeContext()
      runtimeBridge = ctx.bridge
      handledByRuntime = true
      inbound = runtimeBridge.createInboundMemory({
        conversationId: params.groupId,
        conversationType,
        senderAddress,
        source: conversationSource,
        entityKey: senderAddress ?? `web-user:${params.groupId}`,
        content: userText,
      })
      await runtimeBridge.runtime.createMemory(inbound as any, 'messages' as any)
      state = (await (runtimeBridge.runtime as any).composeState(inbound as any)) as Record<string, unknown>
    }
    const turns = trimTrailingCurrentUserTurn(extractRecentTurns(state), userText)
    historyTurns = turns.length
    const structuredMemoryContext = buildStructuredMemoryContext(state)
    stateForContinuity = {
      ...state,
      recentMessages: turns.map((t) => ({ role: t.role, text: t.text })),
    }
    runtimeTruth = {
      ...runtimeTruth,
      isElizaConnected: true,
      hasConversationMemory: true,
      hasPersistentMemory:
        runtimeTruth.hasPersistentMemory ||
        (inbound as any)?.__persistedToDb === true ||
        Boolean(structuredMemoryContext),
    }
    logger.info('[ai/chat] runtime state loaded', {
      groupId: params.groupId,
      turns: historyTurns,
      persistedInbound: (inbound as any)?.__persistedToDb === true,
      providedRuntimeContext: Boolean(params.runtimeContext),
    })

    if (allowActionExecution) {
      const correlationId = `keepr-${params.groupId}-${Date.now()}`
      const rankedActions = await runtimeBridge.rankActions(userText, inbound as any)
      const maxCandidates = Math.max(1, ACTION_MAX_CANDIDATES)
      const candidates = rankedActions.slice(0, maxCandidates)
      for (const candidate of candidates) {
        const handler = candidate.action?.handler
        if (typeof handler !== 'function') continue
        const actionName = String(candidate.action?.name ?? 'unknown')
        const parts: string[] = []
        try {
          const actionRetryBudget = getActionRetryBudget(actionName, ACTION_MAX_RETRIES)
          await withRetry({
            operation: `action_${actionName.toLowerCase()}`,
            maxRetries: actionRetryBudget,
            correlationId,
            run: async () =>
              withTimeout(
                handler(
                  runtimeBridge!.runtime as any,
                  inbound as any,
                  state as any,
                  undefined,
                  async (content: any) => {
                    if (content?.text) parts.push(String(content.text))
                    return []
                  },
                ),
                ACTION_TIMEOUT_MS,
                `action_timeout_${actionName.toLowerCase()}`,
              ),
          })
          const joined = parts.join('\n\n').trim()
          if (joined) {
            actionReply = joined
            break
          }
        } catch (error) {
          const agentError = toAgentError(error, 'ACTION_FAILED', 'Action execution failed')
          logger.warn('[ai/chat] action candidate failed', {
            action: actionName,
            error: agentError.message,
            code: agentError.code,
          })
        }
      }
    }

    if (actionReply) {
      try {
        const outbound = runtimeBridge.createOutboundMemory(
          params.groupId,
          conversationType,
          actionReply,
          { source: conversationSource },
        )
        await runtimeBridge.runtime.createMemory(outbound as any, 'messages' as any)
        runtimeTruth = {
          ...runtimeTruth,
          hasPersistentMemory: runtimeTruth.hasPersistentMemory || (outbound as any)?.__persistedToDb === true,
        }
      } catch (error) {
        logger.warn('[ai/chat] action reply memory persistence failed (non-blocking)', {
          groupId: params.groupId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      logger.info('[ai/chat] Unified Eliza runtime response', {
        groupId: params.groupId,
        historyTurns,
        usedAction: true,
      })
      return { ok: true, response: actionReply.trim(), handledByRuntime: true }
    }
  } catch (error) {
    runtimeTruth = {
      ...runtimeTruth,
      isElizaConnected: false,
      hasConversationMemory: false,
      hasPersistentMemory: false,
    }
    handledByRuntime = false
    logger.warn('[ai/chat] eliza runtime unavailable; returning bounded fallback', {
      groupId: params.groupId,
      error: error instanceof Error ? error.message : String(error),
    })
    if (identityIntent === 'stack') {
      return { ok: true, response: buildStackSnapshotReply(conversationType, runtimeTruth), handledByRuntime: false }
    }
    if (identityIntent === 'eliza') {
      return { ok: true, response: buildElizaConnectionReply(conversationType, runtimeTruth), handledByRuntime: false }
    }
    if (identityIntent === 'memory') {
      return { ok: true, response: buildMemoryReply(conversationType, runtimeTruth), handledByRuntime: false }
    }
    if (identityIntent === 'vault_deployment') {
      return { ok: true, response: buildVaultDeploymentReply(runtimeTruth), handledByRuntime: false }
    }
    if (identityIntent === 'identity') {
      return { ok: true, response: buildIdentityReply(conversationType, runtimeTruth), handledByRuntime: false }
    }
    return { ok: true, response: buildRuntimeUnavailableFallback(conversationType), handledByRuntime: false }
  }

  if (!handledByRuntime || !runtimeBridge) {
    return { ok: true, response: buildRuntimeUnavailableFallback(conversationType), handledByRuntime: false }
  }

  if (identityIntent === 'stack') {
    return { ok: true, response: buildStackSnapshotReply(conversationType, runtimeTruth), handledByRuntime: true }
  }
  if (identityIntent === 'eliza') {
    return { ok: true, response: buildElizaConnectionReply(conversationType, runtimeTruth), handledByRuntime: true }
  }
  if (identityIntent === 'memory') {
    return { ok: true, response: buildMemoryReply(conversationType, runtimeTruth), handledByRuntime: true }
  }
  if (identityIntent === 'vault_deployment') {
    return { ok: true, response: buildVaultDeploymentReply(runtimeTruth), handledByRuntime: true }
  }
  if (identityIntent === 'identity') {
    return { ok: true, response: buildIdentityReply(conversationType, runtimeTruth), handledByRuntime: true }
  }

  let finalText = actionReply.trim()

  if (!finalText) {
    if (!canCallLlm(params.groupId)) {
      return {
        ok: false,
        response: 'AI is rate-limited. Try again in a few seconds.',
        handledByRuntime: true,
      }
    }

    if (llmService.getAvailableProviders().length === 0) {
      return { ok: false, response: '', handledByRuntime: true }
    }

    recordLlmCall(params.groupId)
    try {
      const ctx = await getChatRuntimeContext()
      const characterConfig = ctx.characterConfig
      const correlationId = `keepr-${params.groupId}-${Date.now()}`
      let vaultContext = ''
      for (const provider of ctx.contextProviders) {
        try {
          const result = await withRetry({
            operation: `context_provider_${String(provider.name ?? 'unknown').toLowerCase()}`,
            maxRetries: EXTERNAL_MAX_RETRIES,
            correlationId,
            run: async () =>
              withTimeout(
                provider.get(runtimeBridge!.runtime as any, inbound as any, state as any),
                5_000,
                `context_provider_timeout_${String(provider.name ?? 'unknown').toLowerCase()}`,
              ),
          })
          if (result?.text) vaultContext += `${String(result.text).trim()}\n`
        } catch (providerError) {
          logger.warn('[ai/chat] context provider failed', {
            provider: String(provider.name ?? 'unknown'),
            error: providerError instanceof Error ? providerError.message : String(providerError),
          })
        }
      }
      const senderAddress = toSenderAddress(params.senderWallet)
      if (senderAddress) {
        vaultContext +=
          '\n[wallet_context]\n' +
          `primary_sender_wallet=${senderAddress}\n` +
          'When the user says "my wallet", "my balance", or "my portfolio", default to this wallet unless they provide another address.\n' +
          '[/wallet_context]\n'
      }

      const continuityBlock = buildContinuityContextBlock(stateForContinuity)
      const truthBlock = buildSystemPrompt(params.vault, conversationType, runtimeTruth)
      const systemPrompt = `${characterConfig.systemPrompt}\n\n${continuityBlock}`.trim()
      const combinedVaultContext = [vaultContext.trim(), truthBlock].filter(Boolean).join('\n\n')

      const identityHint = `[${params.senderWallet.slice(0, 6)}...${params.senderWallet.slice(-4)}]`
      const result = await llmService.generateResponse({
        agentKey: params.groupId,
        userMessage: `${identityHint}: ${userText}`,
        systemPrompt,
        vaultContext: combinedVaultContext.trim(),
        correlationId,
        preferredModel: characterConfig.preferredModel,
      })
      if (!result.text?.trim()) {
        return { ok: false, response: '', handledByRuntime: true }
      }
      finalText = result.text.trim()
    } catch (error) {
      const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'LLM generation failed')
      if (agentError.code === 'BUDGET_EXCEEDED') {
        return {
          ok: false,
          response: 'Daily AI budget limit reached for this agent. Please try again tomorrow.',
          handledByRuntime: true,
        }
      }
      if (agentError.code === 'RATE_LIMITED') {
        return {
          ok: false,
          response: 'AI provider is rate-limited. Please try again shortly.',
          handledByRuntime: true,
        }
      }
      if (agentError.code === 'UPSTREAM_TIMEOUT') {
        return { ok: false, response: 'AI request timed out. Please retry.', handledByRuntime: true }
      }
      if (agentError.code === 'DEPENDENCY_UNAVAILABLE') {
        return {
          ok: false,
          response: 'AI provider is temporarily unavailable. Please retry shortly.',
          handledByRuntime: true,
        }
      }
      logger.error('[ai/chat] Unified Eliza LLM call failed', {
        code: agentError.code,
        message: agentError.message,
      })
      return { ok: false, response: '', handledByRuntime: true }
    }
  }

  if (isLikelyIdentityDrift(finalText)) {
    const fallbackIntent = classifyIdentityIntent(userText)
    if (fallbackIntent === 'stack') {
      finalText = buildStackSnapshotReply(conversationType, runtimeTruth)
    } else if (fallbackIntent === 'eliza') {
      finalText = buildElizaConnectionReply(conversationType, runtimeTruth)
    } else if (fallbackIntent === 'memory') {
      finalText = buildMemoryReply(conversationType, runtimeTruth)
    } else if (fallbackIntent === 'vault_deployment') {
      finalText = buildVaultDeploymentReply(runtimeTruth)
    } else if (fallbackIntent === 'identity') {
      finalText = buildIdentityReply(conversationType, runtimeTruth)
    }
  }

  if (runtimeBridge) {
    try {
      const outbound = runtimeBridge.createOutboundMemory(
        params.groupId,
        conversationType,
        finalText,
        { source: conversationSource },
      )
      await runtimeBridge.runtime.createMemory(outbound as any, 'messages' as any)
      runtimeTruth = {
        ...runtimeTruth,
        hasPersistentMemory: runtimeTruth.hasPersistentMemory || (outbound as any)?.__persistedToDb === true,
      }
    } catch (error) {
      logger.warn('[ai/chat] assistant memory persistence failed (non-blocking)', {
        groupId: params.groupId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logger.info('[ai/chat] Unified Eliza runtime response', {
    groupId: params.groupId,
    historyTurns,
    usedAction: Boolean(actionReply),
  })
  return { ok: true, response: finalText, handledByRuntime: true }
}
