import {
  shouldAllowFirstTimeCreate,
  shouldAttemptXmtpRestore,
  shouldRefuseAutoCreateAfterFailedRestore,
  type XmtpConnectIntent,
} from './xmtpConnectPolicy'
import type { ConnectFlowTrace } from './xmtpConnectFlow'

export type RestoreAttemptResult =
  | { kind: 'skipped' }
  | { kind: 'success'; client: unknown }
  | { kind: 'installation_limit' }
  | { kind: 'opfs_lock' }
  | { kind: 'failed' }

export type FinishRestoredXmtpClientResult =
  | { ok: true; setupCalls: number; registerCalls: number }
  | { ok: false; kind: 'invalid_local'; message: string; setupCalls: number; registerCalls: number }
  | {
      ok: false
      kind: 'register_failed'
      message: string
      stillUninitialized: boolean
      setupCalls: number
      registerCalls: number
    }
  | { ok: false; kind: 'transient_failed'; message: string; setupCalls: number; registerCalls: number }

export type XmtpConnectOrchestratorInput = {
  intent: XmtpConnectIntent
  opfsDatabaseExists: boolean
  hasKnownInstallation: boolean
}

export type XmtpConnectOrchestratorDeps = {
  restoreClient: () => Promise<RestoreAttemptResult>
  finishRestoredClient: (client: unknown) => Promise<FinishRestoredXmtpClientResult>
  createClient: () => Promise<unknown>
}

export type XmtpConnectOrchestrationResult = ConnectFlowTrace & {
  client: unknown | null
  errorMessage: string | null
}

function emptyTrace(): ConnectFlowTrace {
  return {
    outcome: 'idle',
    clientBuildCount: 0,
    clientCreateCount: 0,
    registerInPlaceCount: 0,
    setupConversationsCount: 0,
    localStateResetRequired: false,
    installationLimitHit: false,
    refusedChurn: false,
  }
}

/**
 * Mirrors provider.tsx restore → setup → in-place register → create fallthrough.
 * Injectable deps let integration tests mock @xmtp/browser-sdk without mounting React.
 */
export async function executeXmtpConnectOrchestration(
  input: XmtpConnectOrchestratorInput,
  deps: XmtpConnectOrchestratorDeps,
): Promise<XmtpConnectOrchestrationResult> {
  const trace = emptyTrace()
  let client: unknown | null = null
  let errorMessage: string | null = null

  const shouldRestore = shouldAttemptXmtpRestore({
    opfsDatabaseExists: input.opfsDatabaseExists,
    hasKnownInstallation: input.hasKnownInstallation,
  })

  let buildSucceeded = false

  if (shouldRestore) {
    trace.clientBuildCount += 1
    const restoreResult = await deps.restoreClient()

    switch (restoreResult.kind) {
      case 'skipped':
        break
      case 'installation_limit':
        trace.outcome = 'error'
        trace.installationLimitHit = true
        trace.refusedChurn = true
        errorMessage = 'installation_limit'
        return { ...trace, client: null, errorMessage }
      case 'opfs_lock':
        trace.outcome = 'error'
        trace.refusedChurn = true
        errorMessage = 'opfs_lock'
        return { ...trace, client: null, errorMessage }
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
          errorMessage = 'restore_failed_refused'
          return { ...trace, client: null, errorMessage }
        }
        break
      case 'success':
        buildSucceeded = true
        client = restoreResult.client
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
    errorMessage = 'first_time_requires_user_intent'
    return { ...trace, client: null, errorMessage }
  }

  if (buildSucceeded && client != null) {
    const finishResult = await deps.finishRestoredClient(client)
    trace.setupConversationsCount = finishResult.setupCalls
    trace.registerInPlaceCount = finishResult.registerCalls

    if (finishResult.ok) {
      trace.outcome = 'connected'
      return { ...trace, client, errorMessage: null }
    }

    client = null
    trace.outcome = 'error'
    trace.refusedChurn = true
    errorMessage = finishResult.message

    if (finishResult.kind === 'invalid_local' || finishResult.kind === 'register_failed') {
      trace.localStateResetRequired = true
    }

    return { ...trace, client: null, errorMessage }
  }

  if (input.hasKnownInstallation) {
    trace.outcome = 'error'
    trace.localStateResetRequired = true
    trace.refusedChurn = true
    errorMessage = 'provisioned_without_restore'
    return { ...trace, client: null, errorMessage }
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
    errorMessage = 'first_time_requires_user_intent'
    return { ...trace, client: null, errorMessage }
  }

  trace.clientCreateCount = 1
  client = await deps.createClient()
  trace.outcome = 'connected'
  return { ...trace, client, errorMessage: null }
}

/**
 * Shared restore finish path: setup → in-place register on uninitialized → one retry on transient errors.
 */
export async function finishRestoredXmtpClient(input: {
  setupConversations: () => Promise<void>
  registerWithFallback: () => Promise<void>
  isLocalStateInvalidError: (message: string) => boolean
}): Promise<FinishRestoredXmtpClientResult> {
  let setupCalls = 0
  let registerCalls = 0

  const runSetup = async (): Promise<void> => {
    setupCalls += 1
    await input.setupConversations()
  }

  try {
    await runSetup()
    return { ok: true, setupCalls, registerCalls }
  } catch (syncErr) {
    const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr)
    const isUninitialized = syncMsg.toLowerCase().includes('uninitialized')

    if (input.isLocalStateInvalidError(syncMsg)) {
      return { ok: false, kind: 'invalid_local', message: syncMsg, setupCalls, registerCalls }
    }

    if (isUninitialized) {
      try {
        registerCalls += 1
        await input.registerWithFallback()
        await runSetup()
        return { ok: true, setupCalls, registerCalls }
      } catch (registerErr) {
        const regMsg = registerErr instanceof Error ? registerErr.message : String(registerErr)
        return {
          ok: false,
          kind: 'register_failed',
          message: regMsg,
          stillUninitialized: regMsg.toLowerCase().includes('uninitialized'),
          setupCalls,
          registerCalls,
        }
      }
    }

    try {
      await runSetup()
      return { ok: true, setupCalls, registerCalls }
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
      return { ok: false, kind: 'transient_failed', message: retryMsg, setupCalls, registerCalls }
    }
  }
}

export function toConnectFlowTrace(result: XmtpConnectOrchestrationResult): ConnectFlowTrace {
  return {
    outcome: result.outcome,
    clientBuildCount: result.clientBuildCount,
    clientCreateCount: result.clientCreateCount,
    registerInPlaceCount: result.registerInPlaceCount,
    setupConversationsCount: result.setupConversationsCount,
    localStateResetRequired: result.localStateResetRequired,
    installationLimitHit: result.installationLimitHit,
    refusedChurn: result.refusedChurn,
  }
}
