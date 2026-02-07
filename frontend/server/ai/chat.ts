import { logger } from '../_lib/logger.js'
import type { KeeprVaultRow } from '../_lib/keeprRegistry.js'

declare const process: { env: Record<string, string | undefined> }

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'
const MAX_TOKENS = 200
const TEMPERATURE = 0.7

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

function recordLlmCall(groupId: string) {
  groupCooldowns.set(groupId, Date.now())
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
function buildSystemPrompt(vault: KeeprVaultRow | null): string {
  const base = [
    'You are a helpful CreatorVault assistant in an XMTP group chat.',
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an LLM response for a user message in a group chat.
 * Returns `{ ok: false, response: '' }` silently when the LLM is unavailable,
 * rate-limited, or unconfigured — the caller should treat that as "no reply".
 */
export async function generateLlmResponse(params: {
  groupId: string
  senderWallet: string
  text: string
  vault: KeeprVaultRow | null
}): Promise<{ ok: true; response: string } | { ok: false; response: string }> {
  const apiKey = (process.env.OPENAI_API_KEY ?? '').trim()
  if (!apiKey) {
    return { ok: false, response: '' }
  }

  if (!canCallLlm(params.groupId)) {
    return { ok: false, response: 'AI is rate-limited. Try again in a few seconds.' }
  }

  try {
    recordLlmCall(params.groupId)

    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(params.vault) },
          {
            role: 'user',
            content: `[${params.senderWallet.slice(0, 6)}...${params.senderWallet.slice(-4)}]: ${params.text}`,
          },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      logger.error('[ai/chat] OpenAI error', { status: res.status, body: text.slice(0, 300) })
      return { ok: false, response: '' }
    }

    const data = (await res.json()) as any
    const content = data?.choices?.[0]?.message?.content ?? ''
    if (!content.trim()) {
      return { ok: false, response: '' }
    }

    return { ok: true, response: content.trim() }
  } catch (err) {
    logger.error('[ai/chat] LLM call failed', err)
    return { ok: false, response: '' }
  }
}
