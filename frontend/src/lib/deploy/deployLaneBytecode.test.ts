import { describe, expect, it } from 'vitest'
import { keccak256, type Hex } from 'viem'

import { DEPLOY_BYTECODE } from '@/deploy/bytecode.generated'

import {
  fromOnchainVaultKind,
  resolveDeployLanePhase1CodeIds,
  toOnchainVaultKind,
} from './deployLaneBytecode'

describe('deployLaneBytecode', () => {
  it('maps vaultKind to on-chain enum values', () => {
    expect(toOnchainVaultKind('creator')).toBe(0)
    expect(toOnchainVaultKind('agent')).toBe(1)
    expect(fromOnchainVaultKind(1)).toBe('agent')
    expect(fromOnchainVaultKind(0)).toBe('creator')
  })

  it('selects agent lane codeIds from DEPLOY_BYTECODE', () => {
    const codeIds = resolveDeployLanePhase1CodeIds('agent')
    expect(codeIds.vault).toBe(keccak256(DEPLOY_BYTECODE.AgentOVault as Hex))
    expect(codeIds.wrapper).toBe(keccak256(DEPLOY_BYTECODE.AgentOVaultWrapper as Hex))
    expect(codeIds.gauge).toBe(keccak256(DEPLOY_BYTECODE.AgentGaugeController as Hex))
    expect(codeIds.oracle).toBe(keccak256(DEPLOY_BYTECODE.AgentOracle as Hex))
  })

  it('selects creator lane codeIds from DEPLOY_BYTECODE', () => {
    const codeIds = resolveDeployLanePhase1CodeIds('creator')
    expect(codeIds.vault).toBe(keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex))
    expect(codeIds.wrapper).toBe(keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex))
    expect(codeIds.gauge).toBe(keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex))
    expect(codeIds.oracle).toBe(keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex))
  })
})
