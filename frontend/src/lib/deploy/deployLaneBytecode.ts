import { encodePacked, keccak256, type Hex } from 'viem'

import { DEPLOY_BYTECODE } from '../../deploy/bytecode.generated.js'
import type { VaultKind } from '../onchain/agentTokenIntegration.js'

export type OnchainVaultKind = 0 | 1

export type DeployLanePhase1CodeIds = {
  vault: Hex
  wrapper: Hex
  shareOFT: Hex
  gauge: Hex
  cca: Hex
  oracle: Hex
  oftBootstrap: Hex
}

export type DeployLaneBytecodeLabels = {
  vault: string
  wrapper: string
  shareOFT: string
  gauge: string
  oracle: string
  payoutRouter: string
  revenuePolicyController: string
}

export function toOnchainVaultKind(vaultKind: VaultKind): OnchainVaultKind {
  return vaultKind === 'agent' ? 1 : 0
}

export function fromOnchainVaultKind(value: unknown): VaultKind {
  const parsed = parseOnchainVaultKind(value)
  return parsed ?? 'creator'
}

/** Fail-closed parse: only `0` (creator) and `1` (agent) are accepted. */
export function parseOnchainVaultKind(value: unknown): VaultKind | null {
  const numeric = typeof value === 'bigint' ? Number(value) : Number(value)
  if (!Number.isInteger(numeric)) return null
  if (numeric === 0) return 'creator'
  if (numeric === 1) return 'agent'
  return null
}

export function parseVaultKindQueryParam(raw: string | null | undefined): VaultKind | null {
  const normalized = String(raw ?? '').trim().toLowerCase()
  if (normalized === 'agent' || normalized === '1') return 'agent'
  if (normalized === 'creator' || normalized === '0') return 'creator'
  return null
}

export function resolveDeployLanePhase1CodeIds(vaultKind: VaultKind): DeployLanePhase1CodeIds {
  if (vaultKind === 'agent') {
    return {
      vault: keccak256(DEPLOY_BYTECODE.AgentOVault as Hex),
      wrapper: keccak256(DEPLOY_BYTECODE.AgentOVaultWrapper as Hex),
      shareOFT: keccak256(DEPLOY_BYTECODE.AgentShareOFT as Hex),
      gauge: keccak256(DEPLOY_BYTECODE.AgentGaugeController as Hex),
      cca: keccak256(DEPLOY_BYTECODE.CCALaunchArm as Hex),
      oracle: keccak256(DEPLOY_BYTECODE.AgentOracle as Hex),
      oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
    }
  }

  return {
    vault: keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex),
    wrapper: keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex),
    shareOFT: keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex),
    gauge: keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex),
    cca: keccak256(DEPLOY_BYTECODE.CCALaunchArm as Hex),
    oracle: keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex),
    oftBootstrap: keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex),
  }
}

export function resolveDeployLanePayoutRouterCodeId(vaultKind: VaultKind): Hex {
  if (vaultKind === 'agent') {
    return keccak256(DEPLOY_BYTECODE.AgentRevenueRouter as Hex)
  }
  return keccak256(DEPLOY_BYTECODE.CreatorPayoutRouter as Hex)
}

export function resolveDeployLaneVaultBytecode(vaultKind: VaultKind): Hex {
  return vaultKind === 'agent'
    ? (DEPLOY_BYTECODE.AgentOVault as Hex)
    : (DEPLOY_BYTECODE.CreatorOVault as Hex)
}

export function resolveDeployLaneWrapperBytecode(vaultKind: VaultKind): Hex {
  return vaultKind === 'agent'
    ? (DEPLOY_BYTECODE.AgentOVaultWrapper as Hex)
    : (DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex)
}

export function resolveDeployLaneShareOftBytecode(_vaultKind: VaultKind): Hex {
  // AgentShareOFT and CreatorShareOFT share creation bytecode in v1.16.0.
  return DEPLOY_BYTECODE.CreatorShareOFT as Hex
}

export function resolveDeployLaneGaugeBytecode(vaultKind: VaultKind): Hex {
  return vaultKind === 'agent'
    ? (DEPLOY_BYTECODE.AgentGaugeController as Hex)
    : (DEPLOY_BYTECODE.CreatorGaugeController as Hex)
}

export function resolveDeployLaneOracleBytecode(vaultKind: VaultKind): Hex {
  return vaultKind === 'agent'
    ? (DEPLOY_BYTECODE.AgentOracle as Hex)
    : (DEPLOY_BYTECODE.CreatorOracle as Hex)
}

export function resolveDeployLanePayoutRouterBytecode(vaultKind: VaultKind): Hex {
  return vaultKind === 'agent'
    ? (DEPLOY_BYTECODE.AgentRevenueRouter as Hex)
    : (DEPLOY_BYTECODE.CreatorPayoutRouter as Hex)
}

export function resolveDeployLaneRevenuePolicyControllerCodeId(vaultKind: VaultKind): Hex {
  if (vaultKind === 'agent') {
    return keccak256(DEPLOY_BYTECODE.AgentRevenuePolicyController as Hex)
  }
  return keccak256(DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex)
}

export function resolveDeployLaneRevenuePolicyControllerBytecode(vaultKind: VaultKind): Hex {
  return vaultKind === 'agent'
    ? (DEPLOY_BYTECODE.AgentRevenuePolicyController as Hex)
    : (DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex)
}

export function resolveDeployLaneVaultSaltLabel(vaultKind: VaultKind): 'vault' | 'agentVault' {
  return vaultKind === 'agent' ? 'agentVault' : 'vault'
}

export function resolveDeployLaneWrapperSaltLabel(vaultKind: VaultKind): 'wrapper' | 'agentWrapper' {
  return vaultKind === 'agent' ? 'agentWrapper' : 'wrapper'
}

export function resolveDeployLaneCoreModuleKind(vaultKind: VaultKind): Hex {
  if (vaultKind === 'agent') {
    return keccak256(encodePacked(['string'], ['AgentOVaultModule.core']))
  }
  return keccak256(encodePacked(['string'], ['CreatorOVaultModule.core']))
}

export function resolveDeployLaneBytecodeLabels(vaultKind: VaultKind): DeployLaneBytecodeLabels {
  if (vaultKind === 'agent') {
    return {
      vault: 'AgentOVault',
      wrapper: 'AgentOVaultWrapper',
      shareOFT: 'AgentShareOFT',
      gauge: 'AgentGaugeController',
      oracle: 'AgentOracle',
      payoutRouter: 'AgentRevenueRouter',
      revenuePolicyController: 'AgentRevenuePolicyController',
    }
  }

  return {
    vault: 'CreatorOVault',
    wrapper: 'CreatorOVaultWrapper',
    shareOFT: 'CreatorShareOFT',
    gauge: 'CreatorGaugeController',
    oracle: 'CreatorOracle',
    payoutRouter: 'CreatorPayoutRouter',
    revenuePolicyController: 'CreatorCoinPolicyController',
  }
}

/** Both Creator and Agent lanes deploy a revenue policy controller auxiliary. */
export function usesRevenuePolicyController(_vaultKind: VaultKind): boolean {
  return true
}

/**
 * CreatorCoin multi-owner grant path only. Agent enforcement uses AgentTokenV4
 * `setProjectTaxRecipient` via AgentRevenuePolicyController after cooperation preflight.
 */
export function usesCreatorCoinPolicyController(vaultKind: VaultKind): boolean {
  return vaultKind === 'creator'
}
