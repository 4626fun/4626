import { describe, expect, it } from 'vitest'
import { keccak256, type Hex } from 'viem'

import { DEPLOY_BYTECODE } from '../../deploy/bytecode.generated.js'

import {
  fromOnchainVaultKind,
  parseOnchainVaultKind,
  resolveDeployLaneBytecodeLabels,
  resolveDeployLanePhase1CodeIds,
  resolveDeployLaneRevenuePolicyControllerCodeId,
  toOnchainVaultKind,
  usesCreatorCoinPolicyController,
  usesRevenuePolicyController,
} from './deployLaneBytecode'

describe('deployLaneBytecode', () => {
  it('maps vaultKind to on-chain enum values', () => {
    expect(toOnchainVaultKind('creator')).toBe(0)
    expect(toOnchainVaultKind('agent')).toBe(1)
    expect(fromOnchainVaultKind(1)).toBe('agent')
    expect(fromOnchainVaultKind(0)).toBe('creator')
    expect(parseOnchainVaultKind(0)).toBe('creator')
    expect(parseOnchainVaultKind(1)).toBe('agent')
    expect(parseOnchainVaultKind(2)).toBeNull()
    expect(parseOnchainVaultKind('nope')).toBeNull()
    // Legacy default for non-strict callers remains creator.
    expect(fromOnchainVaultKind(2)).toBe('creator')
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

  it('resolves lane-specific revenue policy controller code ids and labels', () => {
    expect(resolveDeployLaneRevenuePolicyControllerCodeId('creator')).toBe(
      keccak256(DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex),
    )
    expect(resolveDeployLaneRevenuePolicyControllerCodeId('agent')).toBe(
      keccak256(DEPLOY_BYTECODE.AgentRevenuePolicyController as Hex),
    )
    expect(resolveDeployLaneBytecodeLabels('agent').revenuePolicyController).toBe(
      'AgentRevenuePolicyController',
    )
    expect(usesRevenuePolicyController('agent')).toBe(true)
    expect(usesRevenuePolicyController('creator')).toBe(true)
    expect(usesCreatorCoinPolicyController('agent')).toBe(false)
    expect(usesCreatorCoinPolicyController('creator')).toBe(true)
  })
})
