import { describe, expect, it } from 'vitest'

import { deriveSwapConnectGate } from './connectGate'

describe('deriveSwapConnectGate', () => {
  it('returns hydrating while the session has not finished its initial probe', () => {
    const result = deriveSwapConnectGate({
      sessionHydrated: false,
      hasSession: false,
      executionAddress: null,
    })

    expect(result.state).toBe('hydrating')
    expect(result.ready).toBe(false)
    expect(result.showSpinner).toBe(true)
    expect(result.actionLabel).toBe('')
  })

  it('hydrating wins even if auth is busy', () => {
    const result = deriveSwapConnectGate({
      sessionHydrated: false,
      hasSession: false,
      executionAddress: null,
      authBusy: true,
    })

    expect(result.state).toBe('hydrating')
  })

  it('prefers signed-out when the session is hydrated but no session exists', () => {
    const result = deriveSwapConnectGate({
      sessionHydrated: true,
      hasSession: false,
      executionAddress: '0x000000000000000000000000000000000000dEaD',
    })

    expect(result.state).toBe('signed-out')
    expect(result.ready).toBe(false)
    expect(result.actionLabel).toBe('Sign in to 4626')
    expect(result.showSpinner).toBe(false)
  })

  it('asks for a wallet connection when the session exists but no execution address is resolved', () => {
    const result = deriveSwapConnectGate({
      sessionHydrated: true,
      hasSession: true,
      executionAddress: null,
    })

    expect(result.state).toBe('wallet-required')
    expect(result.ready).toBe(false)
    expect(result.actionLabel).toBe('Connect wallet')
  })

  it('treats empty / whitespace execution addresses as wallet-required', () => {
    expect(
      deriveSwapConnectGate({ sessionHydrated: true, hasSession: true, executionAddress: '' }).state,
    ).toBe('wallet-required')
    expect(
      deriveSwapConnectGate({ sessionHydrated: true, hasSession: true, executionAddress: '   ' }).state,
    ).toBe('wallet-required')
    expect(
      deriveSwapConnectGate({ sessionHydrated: true, hasSession: true, executionAddress: undefined }).state,
    ).toBe('wallet-required')
  })

  it('holds a stable signing-in state while auth is busy and no execution address is resolved', () => {
    // signed-out + busy → signing-in (Privy modal in progress)
    expect(
      deriveSwapConnectGate({
        sessionHydrated: true,
        hasSession: false,
        executionAddress: null,
        authBusy: true,
      }).state,
    ).toBe('signing-in')

    // session just created, wagmi connector still attaching → signing-in
    expect(
      deriveSwapConnectGate({
        sessionHydrated: true,
        hasSession: true,
        executionAddress: null,
        authBusy: true,
      }).state,
    ).toBe('signing-in')
  })

  it('reports ready before signing-in once the execution address is resolved, even if busy flag lags', () => {
    const result = deriveSwapConnectGate({
      sessionHydrated: true,
      hasSession: true,
      executionAddress: '0x000000000000000000000000000000000000dEaD',
      authBusy: true,
    })

    expect(result.state).toBe('ready')
  })

  it('is ready once session is hydrated, session exists, and an execution address is resolved', () => {
    const result = deriveSwapConnectGate({
      sessionHydrated: true,
      hasSession: true,
      executionAddress: '0x000000000000000000000000000000000000dEaD',
    })

    expect(result.state).toBe('ready')
    expect(result.ready).toBe(true)
    expect(result.actionLabel).toBe('')
    expect(result.title).toBe('')
  })
})
