import { createHash } from 'node:crypto'

const NON_IDEMPOTENT_ACTIONS = new Set([
  'KEEPR_COMMAND',
  'ZORA_COIN',
  'KEEPR_TRIGGER',
  'UNISWAP_SKILL',
])

export function getActionRetryBudget(actionName: string, defaultRetries: number): number {
  if (NON_IDEMPOTENT_ACTIONS.has(String(actionName ?? '').toUpperCase())) return 0
  return Math.max(0, Math.floor(defaultRetries))
}

export type AgentConfigFingerprintInput = {
  creatorAddress: string
  xmtpAgentAddress: string
  agentType: 'eoa' | 'csw'
  privyWalletId: string | null
  cswAddress: string | null
  encryptedPrivateKeyB64: string
  encryptedPrivateKeyIvB64: string
  encryptedPrivateKeyTagB64: string
}

export function fingerprintAgentConfig(input: AgentConfigFingerprintInput): string {
  const payload = JSON.stringify({
    creatorAddress: input.creatorAddress.toLowerCase(),
    xmtpAgentAddress: input.xmtpAgentAddress.toLowerCase(),
    agentType: input.agentType,
    privyWalletId: input.privyWalletId ?? null,
    cswAddress: input.cswAddress?.toLowerCase() ?? null,
    encryptedPrivateKeyB64: input.encryptedPrivateKeyB64,
    encryptedPrivateKeyIvB64: input.encryptedPrivateKeyIvB64,
    encryptedPrivateKeyTagB64: input.encryptedPrivateKeyTagB64,
  })
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

export class WelcomeConversationTracker {
  private readonly ttlMs: number
  private readonly maxTracked: number
  private readonly seenAtMs = new Map<string, number>()

  constructor(input?: { ttlMs?: number; maxTracked?: number }) {
    this.ttlMs = Math.max(1_000, Math.floor(input?.ttlMs ?? 86_400_000))
    this.maxTracked = Math.max(1, Math.floor(input?.maxTracked ?? 20_000))
  }

  prune(now = Date.now()): void {
    const cutoff = now - this.ttlMs
    for (const [conversationId, seenAt] of this.seenAtMs.entries()) {
      if (seenAt < cutoff) this.seenAtMs.delete(conversationId)
    }
    while (this.seenAtMs.size > this.maxTracked) {
      const oldestKey = this.seenAtMs.keys().next().value
      if (!oldestKey) break
      this.seenAtMs.delete(oldestKey)
    }
  }

  markAndCheckFirstSeen(conversationId: string, now = Date.now()): boolean {
    this.prune(now)
    const isFirstSeen = !this.seenAtMs.has(conversationId)
    this.seenAtMs.delete(conversationId)
    this.seenAtMs.set(conversationId, now)
    this.prune(now)
    return isFirstSeen
  }

  has(conversationId: string, now = Date.now()): boolean {
    this.prune(now)
    return this.seenAtMs.has(conversationId)
  }

  getDebugState(): { tracked: number; conversationIds: string[] } {
    return {
      tracked: this.seenAtMs.size,
      conversationIds: [...this.seenAtMs.keys()],
    }
  }
}
