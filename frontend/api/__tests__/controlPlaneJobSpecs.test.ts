import { describe, expect, it } from 'vitest'
import {
  buildControlPlaneJobSpec,
  isAllowedControlPlaneInternalPath,
} from '../../server/_lib/controlPlane/controlPlaneJobSpecs.js'

describe('buildControlPlaneJobSpec', () => {
  const base = {
    operationId: 'op_test_1',
    stageId: 'stage_test_1',
    vaultAddress: '0x1111111111111111111111111111111111111111' as const,
  }

  it('maps vault.provision to internal_api control-plane provision path', () => {
    const spec = buildControlPlaneJobSpec({
      ...base,
      operationKind: 'vault.provision',
      payload: {
        chainId: 8453,
        creatorAddress: '0x2222222222222222222222222222222222222222',
        strategyVariant: 'cca',
      },
    })
    expect(spec.path).toBe('/api/keeper/control-plane/provision')
    expect(spec.stageKind).toBe('vault.provision')
    expect(isAllowedControlPlaneInternalPath(spec.path)).toBe(true)
  })

  it('maps vault.maintenance to maintenance path', () => {
    const spec = buildControlPlaneJobSpec({
      ...base,
      operationKind: 'vault.maintenance',
      payload: { mode: 'standard' },
    })
    expect(spec.path).toBe('/api/keeper/control-plane/maintenance')
    expect(spec.body.mode).toBe('standard')
  })

  it('maps vault.settle to settle path', () => {
    const spec = buildControlPlaneJobSpec({
      ...base,
      operationKind: 'vault.settle',
      payload: {
        graduatedAt: '2026-01-01T00:00:00.000Z',
        settlementStage: 'completed',
        settledAt: '2026-01-02T00:00:00.000Z',
      },
    })
    expect(spec.path).toBe('/api/keeper/control-plane/settle')
    expect(spec.stageKind).toBe('vault.settle')
    expect(isAllowedControlPlaneInternalPath(spec.path)).toBe(true)
  })

  it('maps operator.action to operator-action path with parsed action', () => {
    const spec = buildControlPlaneJobSpec({
      ...base,
      operationKind: 'operator.action',
      payload: {
        actionType: 'vault.tend',
        vaultAddress: base.vaultAddress,
      },
    })
    expect(spec.path).toBe('/api/keeper/control-plane/operator-action')
    expect(spec.body.action).toEqual({
      type: 'vault.tend',
      vaultAddress: base.vaultAddress,
    })
  })
})
