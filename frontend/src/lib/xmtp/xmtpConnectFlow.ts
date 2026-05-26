import {
  shouldAllowFirstTimeCreate,
  shouldAttemptXmtpRestore,
  shouldRefuseAutoCreateAfterFailedRestore,
  type XmtpConnectIntent,
} from './xmtpConnectPolicy'

export type RestorePhaseOutcome =
  | 'not_attempted'
  | 'success'
  | 'installation_limit'
  | 'opfs_lock'
  | 'failed'

export type SetupPhaseOutcome =
  | 'not_reached'
  | 'success'
  | 'invalid_local'
  | 'uninitialized_then_registered'
  | 'uninitialized_register_failed'
  | 'uninitialized_register_failed_still_uninitialized'
  | 'transient_then_success'
  | 'transient_then_failed'

export type ConnectFlowInput = {
  intent: XmtpConnectIntent
  opfsDatabaseExists: boolean
  hasKnownInstallation: boolean
  restoreOutcome: RestorePhaseOutcome
  setupOutcome: SetupPhaseOutcome
}

export type ConnectFlowTrace = {
  outcome: 'connected' | 'error' | 'idle'
  clientBuildCount: number
  clientCreateCount: number
  registerInPlaceCount: number
  setupConversationsCount: number
  localStateResetRequired: boolean
  installationLimitHit: boolean
  refusedChurn: boolean
}

/**
 * Pure model of the browser XMTP connect decision tree in provider.tsx.
 * Used for high-volume regression tests that forbid accidental Client.create churn.
 */
export function simulateXmtpConnectFlow(input: ConnectFlowInput): ConnectFlowTrace {
  const trace: ConnectFlowTrace = {
    outcome: 'idle',
    clientBuildCount: 0,
    clientCreateCount: 0,
    registerInPlaceCount: 0,
    setupConversationsCount: 0,
    localStateResetRequired: false,
    installationLimitHit: false,
    refusedChurn: false,
  }

  const shouldRestore = shouldAttemptXmtpRestore({
    opfsDatabaseExists: input.opfsDatabaseExists,
    hasKnownInstallation: input.hasKnownInstallation,
  })

  let buildSucceeded = false

  if (shouldRestore) {
    trace.clientBuildCount += 1
    switch (input.restoreOutcome) {
      case 'not_attempted':
        break
      case 'installation_limit':
        trace.outcome = 'error'
        trace.installationLimitHit = true
        trace.refusedChurn = true
        return trace
      case 'opfs_lock':
        trace.outcome = 'error'
        trace.refusedChurn = true
        return trace
      case 'failed':
        if (
          shouldRefuseAutoCreateAfterFailedRestore({
            restoreSucceeded: false,
            hasKnownInstallation: input.hasKnownInstallation,
            opfsDatabaseExists: input.opfsDatabaseExists,
          })
        ) {
          trace.outcome = 'error'
          trace.localStateResetRequired = input.hasKnownInstallation
          trace.refusedChurn = true
          return trace
        }
        break
      case 'success':
        buildSucceeded = true
        break
      default:
        break
    }
  } else if (
    !shouldAllowFirstTimeCreate({
      intent: input.intent,
      hasKnownInstallation: input.hasKnownInstallation,
      opfsDatabaseExists: input.opfsDatabaseExists,
      restoreSucceeded: false,
    })
  ) {
    trace.outcome = 'idle'
    return trace
  }

  if (buildSucceeded) {
    switch (input.setupOutcome) {
      case 'not_reached':
        trace.outcome = 'error'
        trace.refusedChurn = true
        return trace
      case 'success':
        trace.setupConversationsCount = 1
        trace.outcome = 'connected'
        return trace
      case 'invalid_local':
        trace.setupConversationsCount = 1
        trace.outcome = 'error'
        trace.localStateResetRequired = true
        trace.refusedChurn = true
        return trace
      case 'uninitialized_then_registered':
        trace.setupConversationsCount = 2
        trace.registerInPlaceCount = 1
        trace.outcome = 'connected'
        return trace
      case 'uninitialized_register_failed':
        trace.setupConversationsCount = 1
        trace.registerInPlaceCount = 1
        trace.outcome = 'error'
        trace.localStateResetRequired = true
        trace.refusedChurn = true
        return trace
      case 'uninitialized_register_failed_still_uninitialized':
        trace.setupConversationsCount = 1
        trace.registerInPlaceCount = 1
        trace.outcome = 'error'
        trace.localStateResetRequired = true
        trace.refusedChurn = true
        return trace
      case 'transient_then_success':
        trace.setupConversationsCount = 2
        trace.outcome = 'connected'
        return trace
      case 'transient_then_failed':
        trace.setupConversationsCount = 2
        trace.outcome = 'error'
        trace.refusedChurn = true
        return trace
      default:
        break
    }
  }

  if (input.hasKnownInstallation) {
    trace.outcome = 'error'
    trace.localStateResetRequired = true
    trace.refusedChurn = true
    return trace
  }

  if (
    !shouldAllowFirstTimeCreate({
      intent: input.intent,
      hasKnownInstallation: input.hasKnownInstallation,
      opfsDatabaseExists: input.opfsDatabaseExists,
      restoreSucceeded: buildSucceeded,
    })
  ) {
    trace.outcome = 'idle'
    return trace
  }

  trace.clientCreateCount = 1
  trace.outcome = 'connected'
  return trace
}

export function isFirstTryConnectWithoutChurn(input: ConnectFlowInput, trace: ConnectFlowTrace): boolean {
  if (trace.clientCreateCount > 0) return false
  if (trace.outcome !== 'connected') return false

  if (input.restoreOutcome === 'success') {
    return (
      input.setupOutcome === 'success' ||
      input.setupOutcome === 'uninitialized_then_registered' ||
      input.setupOutcome === 'transient_then_success'
    )
  }

  return (
    !input.opfsDatabaseExists &&
    !input.hasKnownInstallation &&
    input.intent === 'user' &&
    input.restoreOutcome === 'not_attempted' &&
    input.setupOutcome === 'not_reached'
  )
}

export function normalizeScenario(input: ConnectFlowInput): ConnectFlowInput {
  const shouldRestore = shouldAttemptXmtpRestore({
    opfsDatabaseExists: input.opfsDatabaseExists,
    hasKnownInstallation: input.hasKnownInstallation,
  })

  if (!shouldRestore) {
    return {
      ...input,
      restoreOutcome: 'not_attempted',
      setupOutcome: 'not_reached',
    }
  }

  if (input.restoreOutcome !== 'success') {
    return {
      ...input,
      setupOutcome: 'not_reached',
    }
  }

  return input
}

export function buildConnectFlowScenarioMatrix(): ConnectFlowInput[] {
  const intents: XmtpConnectIntent[] = ['auto', 'user']
  const booleans = [false, true] as const
  const restoreOutcomes: RestorePhaseOutcome[] = [
    'not_attempted',
    'success',
    'installation_limit',
    'opfs_lock',
    'failed',
  ]
  const setupOutcomes: SetupPhaseOutcome[] = [
    'not_reached',
    'success',
    'invalid_local',
    'uninitialized_then_registered',
    'uninitialized_register_failed',
    'uninitialized_register_failed_still_uninitialized',
    'transient_then_success',
    'transient_then_failed',
  ]

  const scenarios: ConnectFlowInput[] = []
  for (const intent of intents) {
    for (const opfsDatabaseExists of booleans) {
      for (const hasKnownInstallation of booleans) {
        for (const restoreOutcome of restoreOutcomes) {
          for (const setupOutcome of setupOutcomes) {
            scenarios.push(
              normalizeScenario({
                intent,
                opfsDatabaseExists,
                hasKnownInstallation,
                restoreOutcome,
                setupOutcome,
              }),
            )
          }
        }
      }
    }
  }
  return scenarios
}

/** Deterministic pseudo-random scenarios to reach large test counts. */
export function buildPseudoRandomConnectFlowScenarios(count: number, seed = 4626): ConnectFlowInput[] {
  const intents: XmtpConnectIntent[] = ['auto', 'user']
  const restoreOutcomes: RestorePhaseOutcome[] = [
    'not_attempted',
    'success',
    'installation_limit',
    'opfs_lock',
    'failed',
  ]
  const setupOutcomes: SetupPhaseOutcome[] = [
    'not_reached',
    'success',
    'invalid_local',
    'uninitialized_then_registered',
    'uninitialized_register_failed',
    'uninitialized_register_failed_still_uninitialized',
    'transient_then_success',
    'transient_then_failed',
  ]

  let state = seed >>> 0
  const next = () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0
    return state
  }
  const pick = <T,>(items: readonly T[]): T => items[next() % items.length]!

  const scenarios: ConnectFlowInput[] = []
  for (let i = 0; i < count; i += 1) {
    scenarios.push(
      normalizeScenario({
        intent: pick(intents),
        opfsDatabaseExists: (next() & 1) === 1,
        hasKnownInstallation: (next() & 1) === 1,
        restoreOutcome: pick(restoreOutcomes),
        setupOutcome: pick(setupOutcomes),
      }),
    )
  }
  return scenarios
}
