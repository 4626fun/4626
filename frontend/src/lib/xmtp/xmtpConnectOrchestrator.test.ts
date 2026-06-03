// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  buildConnectFlowScenarioMatrix,
  buildPseudoRandomConnectFlowScenarios,
  normalizeScenario,
  simulateXmtpConnectFlow,
  type ConnectFlowInput,
  type RestorePhaseOutcome,
  type SetupPhaseOutcome,
} from './xmtpConnectFlow'
import {
  executeXmtpConnectOrchestration,
  finishRestoredXmtpClient,
  toConnectFlowTrace,
  type RestoreAttemptResult,
  type XmtpConnectOrchestratorDeps,
} from './xmtpConnectOrchestrator'
import { isLocalXmtpStateInvalidError } from './xmtpHelpers'

const MATRIX_SCENARIOS = buildConnectFlowScenarioMatrix()
const RANDOM_SCENARIOS = buildPseudoRandomConnectFlowScenarios(Math.max(0, 1000 - MATRIX_SCENARIOS.length))
const ALL_SCENARIOS = [...MATRIX_SCENARIOS, ...RANDOM_SCENARIOS].slice(0, 1000)

function restoreResultForScenario(restoreOutcome: RestorePhaseOutcome): RestoreAttemptResult {
  switch (restoreOutcome) {
    case 'not_attempted':
      return { kind: 'skipped' }
    case 'success':
      return { kind: 'success', client: { inboxId: 'inbox-test' } }
    case 'installation_limit':
      return { kind: 'installation_limit' }
    case 'opfs_lock':
      return { kind: 'opfs_lock' }
    case 'failed':
      return { kind: 'failed' }
    default:
      return { kind: 'skipped' }
  }
}

function finishResultForScenario(setupOutcome: SetupPhaseOutcome) {
  switch (setupOutcome) {
    case 'success':
      return { ok: true as const, setupCalls: 1, registerCalls: 0 }
    case 'invalid_local':
      return {
        ok: false as const,
        kind: 'invalid_local' as const,
        message: 'InboxValidationFailed',
        setupCalls: 1,
        registerCalls: 0,
      }
    case 'uninitialized_then_registered':
      return { ok: true as const, setupCalls: 2, registerCalls: 1 }
    case 'uninitialized_register_failed':
      return {
        ok: false as const,
        kind: 'register_failed' as const,
        message: 'User rejected the request',
        stillUninitialized: false,
        setupCalls: 1,
        registerCalls: 1,
      }
    case 'uninitialized_register_failed_still_uninitialized':
      return {
        ok: false as const,
        kind: 'register_failed' as const,
        message: 'still uninitialized identity',
        stillUninitialized: true,
        setupCalls: 1,
        registerCalls: 1,
      }
    case 'transient_then_success':
      return { ok: true as const, setupCalls: 2, registerCalls: 0 }
    case 'transient_then_failed':
      return {
        ok: false as const,
        kind: 'transient_failed' as const,
        message: 'network timeout',
        setupCalls: 2,
        registerCalls: 0,
      }
    default:
      return {
        ok: false as const,
        kind: 'transient_failed' as const,
        message: 'unexpected setup path',
        setupCalls: 0,
        registerCalls: 0,
      }
  }
}

function createMockDepsForScenario(scenario: ConnectFlowInput): {
  deps: XmtpConnectOrchestratorDeps
  createCalls: { count: number }
} {
  const createCalls = { count: 0 }
  const finishResult = finishResultForScenario(scenario.setupOutcome)

  const deps: XmtpConnectOrchestratorDeps = {
    restoreClient: async () => restoreResultForScenario(scenario.restoreOutcome),
    finishRestoredClient: async () => finishResult,
    createClient: async () => {
      createCalls.count += 1
      return { inboxId: 'created-inbox', installationId: 'created-install' }
    },
  }

  return { deps, createCalls }
}

describe('finishRestoredXmtpClient', () => {
  it('connects on first setup when local OPFS is healthy', async () => {
    const result = await finishRestoredXmtpClient({
      setupConversations: async () => {},
      registerWithFallback: async () => {
        throw new Error('register should not run')
      },
      isLocalStateInvalidError: isLocalXmtpStateInvalidError,
    })
    expect(result).toEqual({ ok: true, setupCalls: 1, registerCalls: 0 })
  })

  it('registers in-place on uninitialized identity without creating a new install', async () => {
    let setupCount = 0
    const result = await finishRestoredXmtpClient({
      setupConversations: async () => {
        setupCount += 1
        if (setupCount === 1) throw new Error('Uninitialized identity')
      },
      registerWithFallback: async () => {},
      isLocalStateInvalidError: isLocalXmtpStateInvalidError,
    })
    expect(result).toEqual({ ok: true, setupCalls: 2, registerCalls: 1 })
  })

  it('refuses churn when in-place registration fails', async () => {
    const result = await finishRestoredXmtpClient({
      setupConversations: async () => {
        throw new Error('Uninitialized identity')
      },
      registerWithFallback: async () => {
        throw new Error('User rejected the request')
      },
      isLocalStateInvalidError: isLocalXmtpStateInvalidError,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.kind).toBe('register_failed')
      expect(result.registerCalls).toBe(1)
      expect(result.setupCalls).toBe(1)
    }
  })

  it('retries setup without registration when identity is already registered', async () => {
    let setupCount = 0
    const result = await finishRestoredXmtpClient({
      setupConversations: async () => {
        setupCount += 1
        if (setupCount === 1) throw new Error('Uninitialized identity')
      },
      registerWithFallback: async () => {
        throw new Error('register should not run')
      },
      isLocalStateInvalidError: isLocalXmtpStateInvalidError,
      isRegistered: async () => true,
    })
    expect(result).toEqual({ ok: true, setupCalls: 2, registerCalls: 0 })
  })

  it('marks invalid local state without attempting registration', async () => {
    const result = await finishRestoredXmtpClient({
      setupConversations: async () => {
        throw new Error('InboxValidationFailed: local install drift')
      },
      registerWithFallback: async () => {
        throw new Error('register should not run')
      },
      isLocalStateInvalidError: isLocalXmtpStateInvalidError,
    })
    expect(result).toMatchObject({
      ok: false,
      kind: 'invalid_local',
      registerCalls: 0,
    })
  })
})

describe('executeXmtpConnectOrchestration integration', () => {
  it('uses Client.create exactly once for explicit first-time user connect', async () => {
    const createCalls = { count: 0 }
    const result = await executeXmtpConnectOrchestration(
      {
        intent: 'user',
        opfsDatabaseExists: false,
        hasKnownInstallation: false,
      },
      {
        restoreClient: async () => ({ kind: 'skipped' }),
        finishRestoredClient: async () => {
          throw new Error('finish should not run')
        },
        createClient: async () => {
          createCalls.count += 1
          return { inboxId: 'new-inbox' }
        },
      },
    )

    expect(result.outcome).toBe('connected')
    expect(result.clientCreateCount).toBe(1)
    expect(createCalls.count).toBe(1)
    expect(result.client).toEqual({ inboxId: 'new-inbox' })
  })

  it('never calls Client.create when restore succeeds', async () => {
    const createCalls = { count: 0 }
    const result = await executeXmtpConnectOrchestration(
      {
        intent: 'auto',
        opfsDatabaseExists: true,
        hasKnownInstallation: true,
      },
      {
        restoreClient: async () => ({ kind: 'success', client: { inboxId: 'restored' } }),
        finishRestoredClient: async () => ({ ok: true, setupCalls: 1, registerCalls: 0 }),
        createClient: async () => {
          createCalls.count += 1
          return { inboxId: 'should-not-run' }
        },
      },
    )

    expect(result).toMatchObject({
      outcome: 'connected',
      clientBuildCount: 1,
      clientCreateCount: 0,
    })
    expect(createCalls.count).toBe(0)
  })

  it('matches the identity-registration-failed anti-churn path', async () => {
    const createCalls = { count: 0 }
    const result = await executeXmtpConnectOrchestration(
      {
        intent: 'user',
        opfsDatabaseExists: true,
        hasKnownInstallation: true,
      },
      {
        restoreClient: async () => ({ kind: 'success', client: { inboxId: 'restored' } }),
        finishRestoredClient: async () => ({
          ok: false,
          kind: 'register_failed',
          message: 'User rejected the request',
          stillUninitialized: false,
          setupCalls: 1,
          registerCalls: 1,
        }),
        createClient: async () => {
          createCalls.count += 1
          return {}
        },
      },
    )

    expect(result).toMatchObject({
      outcome: 'error',
      clientCreateCount: 0,
      registerInPlaceCount: 1,
      localStateResetRequired: true,
      refusedChurn: true,
    })
    expect(createCalls.count).toBe(0)
  })
})

describe.each(ALL_SCENARIOS.map((scenario, index) => [index, scenario] as const))(
  'orchestrator matches simulator scenario #%i',
  (_index, rawScenario) => {
    it('produces the same anti-churn trace as the pure simulator', async () => {
      const scenario = normalizeScenario(rawScenario)
      const expected = simulateXmtpConnectFlow(scenario)
      const { deps, createCalls } = createMockDepsForScenario(scenario)
      const actual = toConnectFlowTrace(
        await executeXmtpConnectOrchestration(
          {
            intent: scenario.intent,
            opfsDatabaseExists: scenario.opfsDatabaseExists,
            hasKnownInstallation: scenario.hasKnownInstallation,
          },
          deps,
        ),
      )

      expect(actual).toEqual(expected)
      expect(createCalls.count).toBe(expected.clientCreateCount)
    })
  },
)
