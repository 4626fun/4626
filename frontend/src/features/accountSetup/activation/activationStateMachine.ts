export type ActivationStage =
  | 'idle'
  | 'preparing'
  | 'needs_base_wallet'
  | 'awaiting_visible_signature'
  | 'confirming_embedded_owner'
  | 'installing_server_owner_silently'
  | 'confirming_server_owner'
  | 'provisioning_xmtp'
  | 'ready'
  | 'partial_ready'
  | 'error'

export type ActivationFailureStage =
  | 'status'
  | 'prepare'
  | 'visible_signature'
  | 'embedded_owner_confirmation'
  | 'silent_server_owner_install'
  | 'server_owner_confirmation'
  | 'xmtp_provisioning'

export type ActivationSnapshot = {
  privySessionReady: boolean
  hasParentCsw: boolean
  baseWalletMatchesParent: boolean
  embeddedOwnerConfirmed: boolean
  serverWalletExpected: boolean
  serverOwnerConfirmed: boolean
  xmtpProvisioned: boolean
}

export type ActivationState = {
  stage: ActivationStage
  runId: string | null
  embeddedOwnerConfirmed: boolean
  failureStage: ActivationFailureStage | null
  error: string | null
}

export type ActivationEvent =
  | { type: 'STATUS_RESOLVED'; snapshot: ActivationSnapshot }
  | { type: 'START'; runId: string }
  | { type: 'VISIBLE_SIGNATURE_REQUIRED' }
  | { type: 'VISIBLE_SIGNATURE_SUBMITTED' }
  | { type: 'EMBEDDED_OWNER_CONFIRMED' }
  | { type: 'SILENT_SERVER_INSTALL_STARTED' }
  | { type: 'SILENT_SERVER_INSTALL_SUBMITTED' }
  | { type: 'SERVER_OWNER_CONFIRMED' }
  | { type: 'XMTP_PROVISIONING_STARTED' }
  | { type: 'XMTP_PROVISIONED' }
  | { type: 'FAIL'; stage: ActivationFailureStage; message: string }
  | { type: 'RESET_ERROR' }

export const INITIAL_ACTIVATION_STATE: ActivationState = {
  stage: 'idle',
  runId: null,
  embeddedOwnerConfirmed: false,
  failureStage: null,
  error: null,
}

export function deriveActivationStage(snapshot: ActivationSnapshot): ActivationStage {
  if (!snapshot.privySessionReady) return 'idle'
  if (!snapshot.hasParentCsw) return 'needs_base_wallet'
  // Once the embedded owner is confirmed on-chain, Base App provider matching
  // is no longer required for resume/retry of silent automation setup.
  if (!snapshot.embeddedOwnerConfirmed && !snapshot.baseWalletMatchesParent) {
    return 'needs_base_wallet'
  }
  if (!snapshot.embeddedOwnerConfirmed) return 'idle'
  if (!snapshot.serverWalletExpected || !snapshot.serverOwnerConfirmed || !snapshot.xmtpProvisioned) {
    return 'partial_ready'
  }
  return 'ready'
}

function failClosedAfterEmbeddedOwner(state: ActivationState): ActivationStage {
  if (state.embeddedOwnerConfirmed) return 'partial_ready'
  return state.stage === 'partial_ready' ||
    state.stage === 'installing_server_owner_silently' ||
    state.stage === 'confirming_server_owner' ||
    state.stage === 'provisioning_xmtp'
    ? 'partial_ready'
    : 'error'
}

function isActivationFailureResolved(
  failureStage: ActivationFailureStage | null,
  snapshot: ActivationSnapshot,
  embeddedOwnerConfirmed: boolean,
): boolean {
  if (!failureStage) return true
  switch (failureStage) {
    case 'status':
    case 'prepare':
      return snapshot.privySessionReady && snapshot.hasParentCsw
    case 'visible_signature':
    case 'embedded_owner_confirmation':
      return embeddedOwnerConfirmed
    case 'silent_server_owner_install':
    case 'server_owner_confirmation':
      return snapshot.serverOwnerConfirmed
    case 'xmtp_provisioning':
      return snapshot.xmtpProvisioned
    default: {
      const exhaustive: never = failureStage
      return exhaustive
    }
  }
}

export function activationReducer(
  state: ActivationState,
  event: ActivationEvent,
): ActivationState {
  switch (event.type) {
    case 'STATUS_RESOLVED':
      {
        const embeddedOwnerConfirmed =
          state.embeddedOwnerConfirmed || event.snapshot.embeddedOwnerConfirmed
        const nextStage = deriveActivationStage({
          ...event.snapshot,
          embeddedOwnerConfirmed,
        })
        const failureResolved = isActivationFailureResolved(
          state.failureStage,
          event.snapshot,
          embeddedOwnerConfirmed,
        )
        const preserveError =
          Boolean(state.error) &&
          !failureResolved &&
          nextStage !== 'ready'
        return {
          ...state,
          stage:
            preserveError && embeddedOwnerConfirmed && nextStage === 'idle'
              ? 'partial_ready'
              : preserveError && state.stage === 'error' && nextStage !== 'ready'
                ? 'error'
                : nextStage,
          embeddedOwnerConfirmed,
          failureStage: preserveError ? state.failureStage : null,
          error: preserveError ? state.error : null,
        }
      }
    case 'START':
      return {
        ...state,
        stage:
          state.embeddedOwnerConfirmed || state.stage === 'partial_ready'
            ? 'installing_server_owner_silently'
            : 'preparing',
        runId: event.runId,
        failureStage: null,
        error: null,
      }
    case 'VISIBLE_SIGNATURE_REQUIRED':
      if (
        state.embeddedOwnerConfirmed ||
        (state.stage !== 'preparing' && state.stage !== 'idle')
      ) {
        return state
      }
      return { ...state, stage: 'awaiting_visible_signature', failureStage: null, error: null }
    case 'VISIBLE_SIGNATURE_SUBMITTED':
      if (state.stage !== 'awaiting_visible_signature') return state
      return { ...state, stage: 'confirming_embedded_owner', failureStage: null, error: null }
    case 'EMBEDDED_OWNER_CONFIRMED':
      return {
        ...state,
        stage: 'installing_server_owner_silently',
        embeddedOwnerConfirmed: true,
        failureStage: null,
        error: null,
      }
    case 'SILENT_SERVER_INSTALL_STARTED':
      return {
        ...state,
        stage: 'installing_server_owner_silently',
        failureStage: null,
        error: null,
      }
    case 'SILENT_SERVER_INSTALL_SUBMITTED':
      return { ...state, stage: 'confirming_server_owner', failureStage: null, error: null }
    case 'SERVER_OWNER_CONFIRMED':
    case 'XMTP_PROVISIONING_STARTED':
      return { ...state, stage: 'provisioning_xmtp', failureStage: null, error: null }
    case 'XMTP_PROVISIONED':
      return { ...state, stage: 'ready', failureStage: null, error: null }
    case 'FAIL':
      return {
        ...state,
        stage: failClosedAfterEmbeddedOwner(state),
        failureStage: event.stage,
        error: event.message,
      }
    case 'RESET_ERROR':
      return {
        ...state,
        stage: state.stage === 'partial_ready' ? 'partial_ready' : 'idle',
        failureStage: null,
        error: null,
      }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

export function activationStageLabel(stage: ActivationStage): string {
  switch (stage) {
    case 'idle':
      return 'Ready to enable'
    case 'preparing':
      return 'Preparing activation'
    case 'needs_base_wallet':
      return 'Base Account connection required'
    case 'awaiting_visible_signature':
      return 'Waiting for one Base App approval'
    case 'confirming_embedded_owner':
      return 'Confirming embedded signer'
    case 'installing_server_owner_silently':
      return 'Installing automation signer'
    case 'confirming_server_owner':
      return 'Confirming automation signer'
    case 'provisioning_xmtp':
      return 'Provisioning XMTP'
    case 'ready':
      return '4626 is enabled'
    case 'partial_ready':
      return 'Sponsored signing ready; automation retry needed'
    case 'error':
      return 'Activation needs attention'
    default: {
      const exhaustive: never = stage
      return exhaustive
    }
  }
}
