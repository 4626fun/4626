// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  buildConnectFlowScenarioMatrix,
  buildPseudoRandomConnectFlowScenarios,
  isFirstTryConnectWithoutChurn,
  normalizeScenario,
  simulateXmtpConnectFlow,
  type ConnectFlowInput,
} from './xmtpConnectFlow'
import { shouldAttemptXmtpRestore } from './xmtpConnectPolicy'

const MATRIX_SCENARIOS = buildConnectFlowScenarioMatrix()
const RANDOM_SCENARIOS = buildPseudoRandomConnectFlowScenarios(Math.max(0, 1000 - MATRIX_SCENARIOS.length))
const ALL_SCENARIOS: ConnectFlowInput[] = [...MATRIX_SCENARIOS, ...RANDOM_SCENARIOS].slice(0, 1000)

function assertConnectInvariants(input: ConnectFlowInput, trace: ReturnType<typeof simulateXmtpConnectFlow>): void {
  const hasInstallEvidence = input.opfsDatabaseExists || input.hasKnownInstallation
  const restoreAttempted = shouldAttemptXmtpRestore({
    opfsDatabaseExists: input.opfsDatabaseExists,
    hasKnownInstallation: input.hasKnownInstallation,
  })

  expect(trace.clientCreateCount).toBeLessThanOrEqual(1)

  // Never burn a new installation when local/network install evidence exists.
  if (hasInstallEvidence) {
    expect(trace.clientCreateCount).toBe(0)
  }

  // Passive auto-connect must not create a first-time installation.
  if (!hasInstallEvidence && input.intent === 'auto') {
    expect(trace.clientCreateCount).toBe(0)
  }

  // Explicit first-time user connect is the only create path.
  if (trace.clientCreateCount === 1) {
    expect(input.intent).toBe('user')
    expect(input.opfsDatabaseExists).toBe(false)
    expect(input.hasKnownInstallation).toBe(false)
    expect(input.restoreOutcome).toBe('not_attempted')
  }

  // Restore-first path: successful rebuild never falls through to Client.create.
  if (input.restoreOutcome === 'success') {
    expect(trace.clientCreateCount).toBe(0)
  }

  // Failed restore with install evidence must refuse create (anti-churn).
  if (
    restoreAttempted &&
    input.restoreOutcome !== 'success' &&
    input.restoreOutcome !== 'not_attempted'
  ) {
    expect(trace.clientCreateCount).toBe(0)
    expect(trace.refusedChurn).toBe(true)
  }

  // Uninitialized identity must register in-place — never silently create.
  if (
    input.restoreOutcome === 'success' &&
    (input.setupOutcome === 'uninitialized_then_registered' ||
      input.setupOutcome === 'uninitialized_register_failed' ||
      input.setupOutcome === 'uninitialized_register_failed_still_uninitialized')
  ) {
    expect(trace.clientCreateCount).toBe(0)
    expect(trace.registerInPlaceCount).toBeLessThanOrEqual(1)
  }

  if (trace.refusedChurn) {
    expect(trace.clientCreateCount).toBe(0)
  }

  if (isFirstTryConnectWithoutChurn(input, trace)) {
    expect(trace.outcome).toBe('connected')
    expect(trace.clientCreateCount).toBe(0)
  }
}

describe('xmtpConnectFlow simulator', () => {
  it('covers exactly 1000 connect scenarios', () => {
    expect(ALL_SCENARIOS).toHaveLength(1000)
  })

  it('normalizes impossible restore/setup combinations', () => {
    const normalized = normalizeScenario({
      intent: 'auto',
      opfsDatabaseExists: false,
      hasKnownInstallation: false,
      restoreOutcome: 'success',
      setupOutcome: 'success',
    })
    expect(normalized.restoreOutcome).toBe('not_attempted')
    expect(normalized.setupOutcome).toBe('not_reached')
  })

  it('models first-time explicit user connect as a single Client.create', () => {
    const trace = simulateXmtpConnectFlow({
      intent: 'user',
      opfsDatabaseExists: false,
      hasKnownInstallation: false,
      restoreOutcome: 'not_attempted',
      setupOutcome: 'not_reached',
    })
    expect(trace).toMatchObject({
      outcome: 'connected',
      clientBuildCount: 0,
      clientCreateCount: 1,
      registerInPlaceCount: 0,
      refusedChurn: false,
    })
  })

  it('restores and connects without create on first try when OPFS is healthy', () => {
    const trace = simulateXmtpConnectFlow({
      intent: 'auto',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'success',
      setupOutcome: 'success',
    })
    expect(isFirstTryConnectWithoutChurn(
      {
        intent: 'auto',
        opfsDatabaseExists: true,
        hasKnownInstallation: true,
        restoreOutcome: 'success',
        setupOutcome: 'success',
      },
      trace,
    )).toBe(true)
    expect(trace.clientCreateCount).toBe(0)
    expect(trace.clientBuildCount).toBe(1)
  })

  it('registers uninitialized restored installs in-place without create', () => {
    const trace = simulateXmtpConnectFlow({
      intent: 'user',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'success',
      setupOutcome: 'uninitialized_then_registered',
    })
    expect(trace).toMatchObject({
      outcome: 'connected',
      clientCreateCount: 0,
      registerInPlaceCount: 1,
      setupConversationsCount: 2,
    })
  })

  it('refuses create when in-place registration fails (identity registration failed path)', () => {
    const trace = simulateXmtpConnectFlow({
      intent: 'user',
      opfsDatabaseExists: true,
      hasKnownInstallation: true,
      restoreOutcome: 'success',
      setupOutcome: 'uninitialized_register_failed',
    })
    expect(trace).toMatchObject({
      outcome: 'error',
      clientCreateCount: 0,
      registerInPlaceCount: 1,
      localStateResetRequired: true,
      refusedChurn: true,
    })
  })
})

describe.each(ALL_SCENARIOS.map((scenario, index) => [index, scenario] as const))(
  'xmtp connect scenario #%i',
  (_index, scenario) => {
    it('never churns installations and preserves first-try restore paths', () => {
      const trace = simulateXmtpConnectFlow(scenario)
      assertConnectInvariants(scenario, trace)
    })
  },
)
