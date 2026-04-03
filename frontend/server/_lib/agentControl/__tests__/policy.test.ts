import { describe, expect, it } from 'vitest'

import { ControlPolicyError, assertPolicy, evaluatePolicy } from '../policy.js'
import type { ActionProposal, ControlCapability } from '../types.js'

function baseCapability(overrides: Partial<ControlCapability> = {}): ControlCapability {
  return {
    capability_id: 'cap_test',
    actor_type: 'telegram_user',
    actor_id: 'tg-user-1',
    subsystem: 'telegram_trade',
    action: 'trade.buy',
    scope: {
      chain_id: 8453,
      creator_coin_address: '0x00000000000000000000000000000000000000aa',
      actor_binding: {
        telegram_user_id: 'tg-user-1',
        chat_id: 'chat-1',
      },
    },
    limits: {
      ttl_seconds: 90,
      amount_ceiling: {
        unit: 'eth',
        value: 1,
      },
      allowed_targets: ['0x00000000000000000000000000000000000000aa'],
    },
    confirmation_class: 'human_plus_policy',
    issued_at: '2026-04-02T10:00:00.000Z',
    expires_at: '2026-04-02T10:02:00.000Z',
    issued_by: 'tests',
    metadata: {},
    ...overrides,
  }
}

function baseProposal(overrides: Partial<ActionProposal> = {}): ActionProposal {
  return {
    proposal_id: 'prop_test',
    capability_id: 'cap_test',
    subsystem: 'telegram_trade',
    action: 'trade.buy',
    intent: {},
    rationale: 'test',
    bounds: {},
    correlation_id: 'corr-1',
    created_at: '2026-04-02T10:01:00.000Z',
    requested_confirmation_class: 'human_plus_policy',
    metadata: {},
    ...overrides,
  }
}

describe('agent control policy', () => {
  it('allows in-scope proposal with matching actor, scope, confirmation, and amount', () => {
    const result = evaluatePolicy({
      capability: baseCapability(),
      proposal: baseProposal(),
      context: {
        actor_type: 'telegram_user',
        actor_id: 'tg-user-1',
        telegram_user_id: 'tg-user-1',
        chat_id: 'chat-1',
        subsystem: 'telegram_trade',
        action: 'trade.buy',
        chain_id: 8453,
        creator_coin_address: '0x00000000000000000000000000000000000000aa',
        target: '0x00000000000000000000000000000000000000aa',
        amount: {
          unit: 'eth',
          value: 0.5,
        },
        confirmation: {
          confirmation_class: 'human_plus_policy',
          approved: true,
          approval_actor_id: 'tg-user-1',
          token_id: 'token-1',
          token_consumed_at: '2026-04-02T10:01:10.000Z',
        },
        now_ms: Date.parse('2026-04-02T10:01:10.000Z'),
      },
      allowlist: {
        subsystems: ['telegram_trade'],
        actions: ['trade.buy'],
      },
    })

    expect(result.allowed).toBe(true)
  })

  it('denies unauthorized actor bindings', () => {
    const result = evaluatePolicy({
      capability: baseCapability(),
      proposal: baseProposal(),
      context: {
        actor_type: 'telegram_user',
        actor_id: 'different-user',
        subsystem: 'telegram_trade',
        action: 'trade.buy',
        confirmation: {
          confirmation_class: 'human_plus_policy',
          approved: true,
          approval_actor_id: 'different-user',
          token_consumed_at: '2026-04-02T10:01:10.000Z',
        },
        now_ms: Date.parse('2026-04-02T10:01:10.000Z'),
      },
    })

    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.deny_code).toBe('actor_mismatch')
  })

  it('denies scope mismatches and unknown action pairs', () => {
    const result = evaluatePolicy({
      capability: baseCapability(),
      proposal: baseProposal({ action: 'trade.sell' }),
      context: {
        actor_type: 'telegram_user',
        actor_id: 'tg-user-1',
        subsystem: 'telegram_trade',
        action: 'trade.buy',
        confirmation: {
          confirmation_class: 'human_plus_policy',
          approved: true,
          approval_actor_id: 'tg-user-1',
          token_consumed_at: '2026-04-02T10:01:10.000Z',
        },
        now_ms: Date.parse('2026-04-02T10:01:10.000Z'),
      },
      allowlist: {
        actions: ['trade.sell'],
      },
    })

    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(['action_mismatch', 'target_not_allowed']).toContain(result.deny_code)
    }
  })

  it('denies expired capability or proposal ttl', () => {
    const capabilityExpired = evaluatePolicy({
      capability: baseCapability({ expires_at: '2026-04-02T10:00:01.000Z' }),
      proposal: baseProposal(),
      context: {
        actor_type: 'telegram_user',
        actor_id: 'tg-user-1',
        subsystem: 'telegram_trade',
        action: 'trade.buy',
        confirmation: {
          confirmation_class: 'human_plus_policy',
          approved: true,
          approval_actor_id: 'tg-user-1',
          token_consumed_at: '2026-04-02T10:01:10.000Z',
        },
        now_ms: Date.parse('2026-04-02T10:01:10.000Z'),
      },
    })
    expect(capabilityExpired.allowed).toBe(false)
    if (!capabilityExpired.allowed) expect(capabilityExpired.deny_code).toBe('capability_expired')

    const proposalExpired = evaluatePolicy({
      capability: baseCapability({
        limits: {
          ttl_seconds: 10,
        },
      }),
      proposal: baseProposal({ created_at: '2026-04-02T10:00:00.000Z' }),
      context: {
        actor_type: 'telegram_user',
        actor_id: 'tg-user-1',
        subsystem: 'telegram_trade',
        action: 'trade.buy',
        confirmation: {
          confirmation_class: 'human_plus_policy',
          approved: true,
          approval_actor_id: 'tg-user-1',
          token_consumed_at: '2026-04-02T10:01:10.000Z',
        },
        now_ms: Date.parse('2026-04-02T10:01:10.000Z'),
      },
    })
    expect(proposalExpired.allowed).toBe(false)
    if (!proposalExpired.allowed) expect(proposalExpired.deny_code).toBe('proposal_expired')
  })

  it('denies replayed requests', () => {
    const result = evaluatePolicy({
      capability: baseCapability({
        scope: {},
        limits: { ttl_seconds: 90 },
      }),
      proposal: baseProposal(),
      context: {
        actor_type: 'telegram_user',
        actor_id: 'tg-user-1',
        subsystem: 'telegram_trade',
        action: 'trade.buy',
        replay_key: 'replay-key-1',
        confirmation: {
          confirmation_class: 'human_plus_policy',
          approved: true,
          approval_actor_id: 'tg-user-1',
          token_id: 'token-1',
          token_consumed_at: '2026-04-02T10:01:10.000Z',
        },
        now_ms: Date.parse('2026-04-02T10:01:10.000Z'),
      },
      replayGuard: {
        isReplay: (key) => key === 'replay-key-1',
      },
    })

    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.deny_code).toBe('replay_detected')
  })

  it('throws explicit policy errors via assertPolicy', () => {
    expect(() =>
      assertPolicy({
        capability: baseCapability(),
        proposal: baseProposal(),
        context: {
          actor_type: 'telegram_user',
          actor_id: 'tg-user-1',
          subsystem: 'telegram_trade',
          action: 'trade.buy',
          confirmation: {
            confirmation_class: 'human_plus_policy',
            approved: false,
          },
          now_ms: Date.parse('2026-04-02T10:01:10.000Z'),
        },
      }),
    ).toThrow(ControlPolicyError)
  })
})
