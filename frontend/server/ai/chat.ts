import { logger } from '../_lib/logger.js'
import type { KeeprVaultRow } from '../_lib/keeprRegistry.js'
import { toAgentError } from '../agent/eliza/_errors.js'
import { getElizaLlmService } from '../agent/eliza/llm.js'

const llmService = getElizaLlmService()

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
function buildSystemPrompt(vault: KeeprVaultRow | null): string {
  const base = [
    'You are a helpful 4626 assistant in an XMTP group chat.',
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

export async function generateLlmResponse(params: {
  groupId: string
  senderWallet: string
  text: string
  vault: KeeprVaultRow | null
}): Promise<{ ok: true; response: string } | { ok: false; response: string }> {
  if (!canCallLlm(params.groupId)) {
    return { ok: false, response: 'AI is rate-limited. Try again in a few seconds.' }
  }

  if (llmService.getAvailableProviders().length === 0) {
    return { ok: false, response: '' }
  }

  try {
    recordLlmCall(params.groupId)
    const identityHint = `[${params.senderWallet.slice(0, 6)}...${params.senderWallet.slice(-4)}]`
    const result = await llmService.generateResponse({
      agentKey: params.groupId,
      userMessage: `${identityHint}: ${params.text}`,
      systemPrompt: buildSystemPrompt(params.vault),
      vaultContext: '',
      correlationId: `keepr-${params.groupId}-${Date.now()}`,
    })

    if (!result.text?.trim()) {
      return { ok: false, response: '' }
    }

    logger.info('[ai/chat] Unified Eliza LLM response', {
      groupId: params.groupId,
      provider: result.provider,
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
