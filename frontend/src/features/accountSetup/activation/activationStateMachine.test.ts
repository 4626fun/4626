import { describe, expect, it } from 'vitest'

import {
  INITIAL_ACTIVATION_STATE,
  activationReducer,
  deriveActivationStage,
  type ActivationSnapshot,
} from './activationStateMachine'

const READY_BASE: ActivationSnapshot = {
  privySessionReady: true,
  hasParentCsw: true,
  baseWalletMatchesParent: true,
  embeddedOwnerConfirmed: false,
  serverWalletExpected: false,
  serverOwnerConfirmed: false,
  xmtpProvisioned: false,
}

describe('activation state machine', () => {
  it('routes email-only users to wallet linking', () => {
    expect(
      deriveActivationStage({
        ...READY_BASE,
        hasParentCsw: false,
        baseWalletMatchesParent: false,
      }),
    ).toBe('needs_base_wallet')
  })

  it('resumes after embedded owner confirmation without returning to passkey', () => {
    let state = activationReducer(INITIAL_ACTIVATION_STATE, {
      type: 'STATUS_RESOLVED',
      snapshot: {
        ...READY_BASE,
        embeddedOwnerConfirmed: true,
        serverWalletExpected: true,
      },
    })
    expect(state.stage).toBe('partial_ready')

    state = activationReducer(state, { type: 'START', runId: 'run-1' })
    expect(state.stage).toBe('installing_server_owner_silently')

    state = activationReducer(state, { type: 'VISIBLE_SIGNATURE_REQUIRED' })
    expect(state.stage).toBe('installing_server_owner_silently')
  })

  it('skips silent installation when both owners are already confirmed', () => {
    expect(
      deriveActivationStage({
        ...READY_BASE,
        embeddedOwnerConfirmed: true,
        serverWalletExpected: true,
        serverOwnerConfirmed: true,
        xmtpProvisioned: true,
      }),
    ).toBe('ready')
  })

  it('keeps a post-embedded failure partial-ready for silent retry', () => {
    const state = activationReducer(
      {
        ...INITIAL_ACTIVATION_STATE,
        stage: 'installing_server_owner_silently',
        runId: 'run-2',
      },
      {
        type: 'FAIL',
        stage: 'silent_server_owner_install',
        message: 'bundler unavailable',
      },
    )

    expect(state).toMatchObject({
      stage: 'partial_ready',
      failureStage: 'silent_server_owner_install',
      error: 'bundler unavailable',
    })
  })

  it('does not treat submitted or pending work as ready', () => {
    const state = activationReducer(
      {
        ...INITIAL_ACTIVATION_STATE,
        stage: 'awaiting_visible_signature',
      },
      { type: 'VISIBLE_SIGNATURE_SUBMITTED' },
    )
    expect(state.stage).toBe('confirming_embedded_owner')
    expect(state.stage).not.toBe('ready')
  })

  it('does not regress to another visible approval after embedded ownership was observed', () => {
    const confirmed = activationReducer(INITIAL_ACTIVATION_STATE, {
      type: 'STATUS_RESOLVED',
      snapshot: { ...READY_BASE, embeddedOwnerConfirmed: true },
    })
    const transientRead = activationReducer(confirmed, {
      type: 'STATUS_RESOLVED',
      snapshot: READY_BASE,
    })
    const started = activationReducer(transientRead, { type: 'START', runId: 'retry' })
    const visibleRequested = activationReducer(started, {
      type: 'VISIBLE_SIGNATURE_REQUIRED',
    })

    expect(visibleRequested.embeddedOwnerConfirmed).toBe(true)
    expect(visibleRequested.stage).not.toBe('awaiting_visible_signature')
  })

  it('keeps resume as partial_ready even when Base wallet matching later drops', () => {
    expect(
      deriveActivationStage({
        ...READY_BASE,
        embeddedOwnerConfirmed: true,
        serverWalletExpected: true,
        baseWalletMatchesParent: false,
      }),
    ).toBe('partial_ready')
  })

  it('fail-closes to partial_ready once embedded ownership was observed, even from confirming stage', () => {
    const state = activationReducer(
      {
        ...INITIAL_ACTIVATION_STATE,
        stage: 'confirming_embedded_owner',
        embeddedOwnerConfirmed: true,
        runId: 'run-3',
      },
      {
        type: 'FAIL',
        stage: 'embedded_owner_confirmation',
        message: 'rpc lag',
      },
    )
    expect(state.stage).toBe('partial_ready')
  })

  it('starts silent retry from error when embedded ownership is already known', () => {
    const state = activationReducer(
      {
        ...INITIAL_ACTIVATION_STATE,
        stage: 'error',
        embeddedOwnerConfirmed: true,
        failureStage: 'silent_server_owner_install',
        error: 'bundler unavailable',
      },
      { type: 'START', runId: 'retry-silent' },
    )
    expect(state.stage).toBe('installing_server_owner_silently')
    expect(state.error).toBeNull()
  })

  it('never marks ready from status alone when XMTP is missing', () => {
    expect(
      deriveActivationStage({
        ...READY_BASE,
        embeddedOwnerConfirmed: true,
        serverWalletExpected: true,
        serverOwnerConfirmed: true,
        xmtpProvisioned: false,
      }),
    ).toBe('partial_ready')
  })

  it('preserves failure metadata across status refreshes until the failed step is resolved', () => {
    const failed = activationReducer(
      {
        ...INITIAL_ACTIVATION_STATE,
        stage: 'partial_ready',
        embeddedOwnerConfirmed: true,
        runId: 'run-4',
        failureStage: 'silent_server_owner_install',
        error: 'bundler unavailable',
      },
      {
        type: 'STATUS_RESOLVED',
        snapshot: {
          ...READY_BASE,
          embeddedOwnerConfirmed: true,
          serverWalletExpected: true,
        },
      },
    )
    expect(failed).toMatchObject({
      stage: 'partial_ready',
      failureStage: 'silent_server_owner_install',
      error: 'bundler unavailable',
    })

    const resolved = activationReducer(failed, {
      type: 'STATUS_RESOLVED',
      snapshot: {
        ...READY_BASE,
        embeddedOwnerConfirmed: true,
        serverWalletExpected: true,
        serverOwnerConfirmed: true,
        xmtpProvisioned: true,
      },
    })
    expect(resolved).toMatchObject({
      stage: 'ready',
      failureStage: null,
      error: null,
    })
  })
})
