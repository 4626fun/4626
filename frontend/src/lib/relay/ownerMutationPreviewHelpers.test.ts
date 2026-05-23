import { describe, expect, it } from 'vitest'

import {
  resolveOwnerMutationPhase,
  resolveRelayPreviewStepOneStatus,
  resolveRelaySubmitStepTwoStatus,
} from '@/lib/relay/ownerMutationPreviewHelpers'

describe('ownerMutationPreviewHelpers', () => {
  it('keeps step 1 blocked until relay quote and deposit preflight are actionable', () => {
    expect(
      resolveRelayPreviewStepOneStatus({
        previewLoading: false,
        preview: {
          relay: null,
          preflight: { simulation: { ok: false, error: 'execution reverted' } },
        },
      }),
    ).toBe('blocked')

    expect(
      resolveRelayPreviewStepOneStatus({
        previewLoading: false,
        preview: {
          relay: null,
          preflight: { simulation: { ok: true } },
        },
      }),
    ).toBe('blocked')

    expect(
      resolveRelayPreviewStepOneStatus({
        previewLoading: false,
        preview: {
          relay: { userCall: { value: '0x0' }, paymentDetails: { amount: '0' } },
          preflight: { simulation: { ok: true } },
        },
      }),
    ).toBe('blocked')

    expect(
      resolveRelayPreviewStepOneStatus({
        previewLoading: false,
        preview: {
          relay: { userCall: { value: '0x64' }, paymentDetails: { amount: '100' } },
          preflight: {
            simulation: { ok: true },
            relayDepositSimulation: { ok: false, error: 'reverted' },
          },
        },
      }),
    ).toBe('blocked')

    expect(
      resolveRelayPreviewStepOneStatus({
        previewLoading: false,
        preview: {
          relay: { userCall: { value: '0x64' }, paymentDetails: { amount: '100' } },
          preflight: { simulation: { ok: true }, relayDepositSimulation: { ok: true } },
        },
      }),
    ).toBe('done')
  })

  it('allows step 1 when Relay quote + deposit preflight pass even if bare mutation simulation failed', () => {
    expect(
      resolveRelayPreviewStepOneStatus({
        previewLoading: false,
        preview: {
          relay: { userCall: { value: '0x64' }, paymentDetails: { amount: '100' } },
          preflight: {
            simulation: { ok: false, error: 'execution reverted' },
            relayDepositSimulation: { ok: true },
          },
        },
      }),
    ).toBe('done')
  })

  it('marks step 2 done only after a tx hash lands', () => {
    expect(
      resolveRelaySubmitStepTwoStatus({
        stepOne: 'done',
        txHash: null,
        busy: false,
      }),
    ).toBe('ready')

    expect(
      resolveRelaySubmitStepTwoStatus({
        stepOne: 'blocked',
        txHash: null,
        busy: false,
      }),
    ).toBe('blocked')

    expect(
      resolveRelaySubmitStepTwoStatus({
        stepOne: 'done',
        txHash: '0xabc',
        busy: false,
      }),
    ).toBe('done')
  })

  it('advances one phase at a time', () => {
    expect(
      resolveOwnerMutationPhase({
        stepOne: 'pending',
        stepTwo: 'blocked',
      }),
    ).toBe('preview')

    expect(
      resolveOwnerMutationPhase({
        stepOne: 'done',
        stepTwo: 'ready',
      }),
    ).toBe('submit')

    expect(
      resolveOwnerMutationPhase({
        stepOne: 'done',
        stepTwo: 'done',
      }),
    ).toBe('complete')
  })
})
