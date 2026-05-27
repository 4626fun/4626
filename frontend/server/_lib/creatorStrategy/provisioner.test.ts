import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import {
  dispatchProvisioning,
  listManualProvisioningFeatures,
} from './provisioner'

const CREATOR = getAddress('0x1111111111111111111111111111111111111111')

describe('dispatchProvisioning', () => {
  // Silence console.log from the intent logger for clean test output.
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('enqueues charm_active_lp with a Safe-calldata note referencing the operator script', async () => {
    const res = await dispatchProvisioning({
      creatorToken: CREATOR,
      featureKey: 'charm_active_lp',
      activationId: 1,
      paymentSource: 'stripe',
      paymentRef: 'cs_test_abc',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.outcome).toBe('enqueued')
    expect(res.ref).toBe(null)
    expect(res.note).toContain('activate-strategy-post-deploy')
    expect(res.note).toContain('app.safe.global')
  })

  it('enqueues ajna_sleeve with the same operator-script note', async () => {
    const res = await dispatchProvisioning({
      creatorToken: CREATOR,
      featureKey: 'ajna_sleeve',
      activationId: 2,
      paymentSource: 'usdc_base',
      paymentRef: '0xdeadbeef',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.outcome).toBe('enqueued')
    expect(res.note).toContain('activate-strategy-post-deploy')
  })

  it('rejects retired solana_bridge_strategy as unknown', async () => {
    const res = await dispatchProvisioning({
      creatorToken: CREATOR,
      featureKey: 'solana_bridge_strategy',
      activationId: 3,
      paymentSource: 'x402_base',
      paymentRef: '0xabc',
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('unknown_feature')
  })

  it('enqueues solana_meteora_alpha_vault with Meteora-specific note', async () => {
    const res = await dispatchProvisioning({
      creatorToken: CREATOR,
      featureKey: 'solana_meteora_alpha_vault',
      activationId: 4,
      paymentSource: 'stripe',
      paymentRef: 'cs_meteora',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.outcome).toBe('enqueued')
    expect(res.note).toContain('share-mesh')
    expect(res.note).toContain('solana:create-dlmm-pool')
  })

  it('fails clean on unknown feature keys', async () => {
    const res = await dispatchProvisioning({
      creatorToken: CREATOR,
      featureKey: 'bogus_feature_that_does_not_exist',
      activationId: 5,
      paymentSource: 'stripe',
      paymentRef: null,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('unknown_feature')
  })
})

describe('listManualProvisioningFeatures', () => {
  it('returns one entry per catalog feature with its provisioner tag', () => {
    const list = listManualProvisioningFeatures()
    expect(list.length).toBeGreaterThan(0)
    for (const entry of list) {
      expect(entry.key).toBeTypeOf('string')
      expect(entry.provisionerTag).toBeTypeOf('string')
      expect(entry.provisionerTag.length).toBeGreaterThan(0)
    }
    expect(list.map((f) => f.key)).toContain('charm_active_lp')
    expect(list.map((f) => f.key)).toContain('solana_meteora_alpha_vault')
  })
})
