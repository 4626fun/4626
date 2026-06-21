/**
 * Deploy vault eligibility by account population.
 *
 * Populations align with docs/ACCOUNT_MODEL.md §2:
 *   (a) email-only — no canonical CSW
 *   (b) base-app-passkey — CSW with passkey/session signing, no EOA owner path
 *   (c) zora-eoa-owner — CSW with at least one EOA owner (Zora / external)
 *   (d) zora-passkey-only — Zora CSW, no usable EOA owner for third-party dapps
 */

export type DeployUserPopulation =
  | 'email-only'
  | 'base-app-passkey'
  | 'zora-eoa-owner'
  | 'zora-passkey-only'
  | 'unknown'

export type DeployEligibilityCode =
  | 'ready'
  | 'no-canonical-csw'
  | 'base-app-deploy-blocked'
  | 'zora-passkey-deploy-blocked'
  | 'signing-required'
  | 'simulation-may-fail'

export type DeployEligibilityInput = {
  canonicalCswAddress: string | null
  canonicalIdentityType: 'contract' | 'eoa' | 'unknown'
  zoraLinked?: boolean
  baseAppLinked?: boolean
  executionTrack?: 'legacy-owner-install' | 'none-yet' | null
  onchainEoaOwnerCount?: number
  privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
  /** When set, overrides generic passkey-only Zora block (simulation already failed). */
  creatorCoinActionSimulationFailed?: boolean
}

export type DeployEligibilityResult = {
  population: DeployUserPopulation
  code: DeployEligibilityCode
  /** True when population (c) has deploy-session signing prerequisites. */
  canProceedWithDeploySession: boolean
  /** Show Deploy one-time Privy/Base owner approval panel. */
  showOwnerApprovalPanel: boolean
  /** Human-facing blocker when deploy should not proceed. */
  blockerMessage: string | null
}

function hasCanonicalCsw(input: DeployEligibilityInput): boolean {
  return input.canonicalIdentityType === 'contract' && Boolean(input.canonicalCswAddress?.trim())
}

export function classifyDeployPopulation(input: DeployEligibilityInput): DeployUserPopulation {
  if (!hasCanonicalCsw(input)) {
    return 'email-only'
  }

  const eoaOwners = (input.onchainEoaOwnerCount ?? 0) > 0
  const zora = Boolean(input.zoraLinked)

  if (zora && eoaOwners) return 'zora-eoa-owner'
  if (zora && !eoaOwners) return 'zora-passkey-only'

  if (input.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true || input.executionTrack === 'legacy-owner-install') {
    return 'zora-eoa-owner'
  }

  if (input.baseAppLinked) {
    return 'base-app-passkey'
  }

  return 'unknown'
}

export function evaluateDeployEligibility(input: DeployEligibilityInput): DeployEligibilityResult {
  const population = classifyDeployPopulation(input)

  if (!hasCanonicalCsw(input)) {
    return {
      population,
      code: 'no-canonical-csw',
      canProceedWithDeploySession: false,
      showOwnerApprovalPanel: false,
      blockerMessage:
        'Deploy requires your canonical Coinbase Smart Wallet as sender. Finish Base App or Zora wallet setup first.',
    }
  }

  if (population === 'zora-passkey-only') {
    const simulationHint = input.creatorCoinActionSimulationFailed
      ? ' Update the creator coin payout recipient in Zora before launching a vault here.'
      : ' Owner-gated creator coin steps may need to be completed in Zora or Base App first.'
    return {
      population,
      code: input.creatorCoinActionSimulationFailed ? 'simulation-may-fail' : 'zora-passkey-deploy-blocked',
      canProceedWithDeploySession: false,
      showOwnerApprovalPanel: false,
      blockerMessage: `Vault deploy is not available for passkey-only Zora wallets in the browser.${simulationHint}`,
    }
  }

  if (population === 'base-app-passkey') {
    return {
      population,
      code: 'base-app-deploy-blocked',
      canProceedWithDeploySession: false,
      showOwnerApprovalPanel: false,
      blockerMessage:
        'Vault deploy from a Base App smart wallet is not supported in the browser yet. Swaps work after Connect Base App setup; deploy requires Enable 4626 signing (Zora EOA owner) or an operator handoff.',
    }
  }

  if (population === 'unknown') {
    return {
      population,
      code: 'signing-required',
      canProceedWithDeploySession: false,
      showOwnerApprovalPanel: false,
      blockerMessage:
        'Enable 4626 signing on the waitlist (Step 2) before deploying. Your Privy embedded wallet must be an owner of your canonical smart wallet.',
    }
  }

  const signingReady = input.executionTrack === 'legacy-owner-install' || input.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true

  if (!signingReady) {
    return {
      population,
      code: 'signing-required',
      canProceedWithDeploySession: false,
      showOwnerApprovalPanel: false,
      blockerMessage:
        'Enable 4626 signing on the waitlist (Step 2) before deploying. Your Privy embedded wallet must be an owner of your canonical smart wallet.',
    }
  }

  return {
    population,
    code: 'ready',
    canProceedWithDeploySession: true,
    showOwnerApprovalPanel: true,
    blockerMessage: null,
  }
}
