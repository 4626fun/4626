import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  resolveOwnerMutationPhase,
  resolveRelayFundingShortfall,
  resolveRelayPreviewStepOneStatus,
  resolveRelayRequiredDepositWei,
  resolveRelaySubmitStepTwoStatus,
} from '@/lib/relay/ownerMutationPreviewHelpers'
import { CANONICAL_CSW_ADDRESS } from '@/wallet/canonicalWalletPolicy'

const CSW = getAddress(CANONICAL_CSW_ADDRESS)

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

  it('marks step 2 done only after the full Relay flow completes', () => {
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
    ).toBe('ready')

    expect(
      resolveRelaySubmitStepTwoStatus({
        stepOne: 'done',
        txHash: '0xabc',
        busy: false,
        waitingForRelayFill: true,
      }),
    ).toBe('ready')

    expect(
      resolveRelaySubmitStepTwoStatus({
        stepOne: 'done',
        txHash: '0xabc',
        busy: false,
        flowComplete: true,
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
        flowComplete: true,
      }),
    ).toBe('complete')

    expect(
      resolveOwnerMutationPhase({
        stepOne: 'done',
        stepTwo: 'ready',
        waitingForRelayFill: true,
      }),
    ).toBe('waiting')
  })

  it('falls back to deposit simulation wei when relay paymentDetails are missing', () => {
    expect(
      resolveRelayRequiredDepositWei({
        relay: { userCall: { value: '0x0' }, paymentDetails: { amount: '0' } },
        preflight: {
          relayDepositSimulation: {
            ok: false,
            depositWei: '3013495263000000',
            gasBufferWei: '401799368400000',
            funderBalanceWei: '1386794618158156',
          },
        },
      }),
    ).toBe(3013495263000000n)
  })

  it('computes relay funding shortfall from deposit preflight', () => {
    expect(
      resolveRelayFundingShortfall({
        txRequest: { to: CSW },
        relay: { userCall: { value: '0x0' }, paymentDetails: null },
        preflight: {
          relayQuoteError:
            `Funder native balance (1386794618158156 wei) is below Relay deposit (3013495263000000 wei). Fund ${CSW} and rebuild preview.`,
          relayDepositSimulation: {
            ok: false,
            depositWei: '3013495263000000',
            gasBufferWei: '401799368400000',
            funderBalanceWei: '1386794618158156',
          },
        },
      }),
    ).toEqual({
      funderAddress: CSW,
      balanceWei: 1386794618158156n,
      depositWei: 3013495263000000n,
      gasBufferWei: 401799368400000n,
      requiredNativeWei: 3013495263000000n,
      recommendedTopUpWei: 3415294631400000n,
      shortfallWei: 2028500013241844n,
    })
  })
})
