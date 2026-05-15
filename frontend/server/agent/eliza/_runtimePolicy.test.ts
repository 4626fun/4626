import { describe, expect, it } from 'vitest'

import {
  WelcomeConversationTracker,
  fingerprintAgentConfig,
  getActionRetryBudget,
} from './_runtimePolicy.ts'

describe('runtime policy', () => {
  it('disables retries for known mutating actions', () => {
    expect(getActionRetryBudget('KEEPR_COMMAND', 2)).toBe(0)
    expect(getActionRetryBudget('ZORA_COIN', 3)).toBe(0)
    expect(getActionRetryBudget('KEEPR_TRIGGER', 3)).toBe(0)
    expect(getActionRetryBudget('UNISWAP_SKILL', 2)).toBe(0)
    expect(getActionRetryBudget('KEEPR_OBSERVE', 3)).toBe(3)
  })

  it('changes fingerprint when relevant agent config changes', () => {
    const base = {
      creatorAddress: '0xabc',
      xmtpAgentAddress: '0xdef',
      agentType: 'csw' as const,
      privyWalletId: 'wallet-1',
      cswAddress: '0x123',
      encryptedPrivateKeyB64: 'k',
      encryptedPrivateKeyIvB64: 'iv',
      encryptedPrivateKeyTagB64: 'tag',
    }
    const a = fingerprintAgentConfig(base)
    const b = fingerprintAgentConfig({ ...base, privyWalletId: 'wallet-2' })
    const c = fingerprintAgentConfig({ ...base, encryptedPrivateKeyB64: 'k2' })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('bounds welcome conversation tracking by ttl and max size', () => {
    const tracker = new WelcomeConversationTracker({
      ttlMs: 1_000,
      maxTracked: 2,
    })

    expect(tracker.markAndCheckFirstSeen('conv-1', 1_000)).toBe(true)
    expect(tracker.markAndCheckFirstSeen('conv-2', 1_010)).toBe(true)
    expect(tracker.markAndCheckFirstSeen('conv-1', 1_020)).toBe(false)

    // Exceeds max tracked, drops the oldest conversation.
    expect(tracker.markAndCheckFirstSeen('conv-3', 1_030)).toBe(true)
    expect(tracker.has('conv-1', 1_031)).toBe(true)
    expect(tracker.has('conv-2', 1_031)).toBe(false)

    // TTL expiration removes stale entries.
    tracker.prune(2_200)
    expect(tracker.has('conv-2', 2_201)).toBe(false)
    expect(tracker.has('conv-3', 2_201)).toBe(false)
  })
})
