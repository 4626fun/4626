import type { Hex } from 'viem'

export type DeploySessionPhaseCall = { data: Hex }

const SELECTOR_FINALIZE_PHASE2 = new Set([
  '0xbd4583fb',
  '0xab56c176',
  '0xcafc9348',
])
const PHASE2_PRE_FINALIZE_SELECTORS = new Set([
  '0x4689260b', // whitelistPayoutRouterOnWrapper(address,address)
  '0x8522016e', // setPayoutRouterShareOftNoFees(address,address)
  '0xafe8d7e9', // deployPhase2Auxiliaries(...)
])
const SELECTOR_DEPLOY_PHASE3_STRATEGIES = '0x881d4960'
const SELECTOR_LAUNCH_DEFERRED_AUCTION = '0x02afdbcb'
const SELECTOR_DEPLOY_TO_STRATEGIES = '0x355aa867'
const POST_AUCTION_CCA_SELECTORS = new Set([
  '0x8fd3ab80', // migrate()
  '0x7c121574', // sweepCurrency()
  '0x809dac30', // finalizeFailedAuction()
])

function readSelector(data: Hex): string {
  if (typeof data !== 'string' || !data.startsWith('0x') || data.length < 10) {
    return '0x'
  }
  return data.slice(0, 10).toLowerCase()
}

function assertNoPostAuctionCcaCalls(calls: DeploySessionPhaseCall[], phaseLabel: string): void {
  for (const call of calls) {
    const selector = readSelector(call.data)
    if (POST_AUCTION_CCA_SELECTORS.has(selector)) {
      throw new Error(`deploy_session_post_auction_call_forbidden:${phaseLabel}:${selector}`)
    }
  }
}

/**
 * Ensures deploy-session UserOps stay phase-isolated:
 * - Phase 2 pre-finalize: aux deploy + batcher wrapper whitelist + ShareOFT NoFees (before ownership transfer)
 * - Phase 2 finalize: split + ownership only (no strategies, no auction launch, no CCA graduation)
 * - Phase 3: deployPhase3Strategies + deployToStrategies (Charm/Ajna TVL), never launchDeferredAuction or migrate
 * - Phase 4: launchDeferredAuction only (schedules CCA; graduation/migrate runs later via keeper)
 */
export function assertDeploySessionPhaseBoundaries(params: {
  phase2PreFinalizeCalls?: DeploySessionPhaseCall[]
  phase2FinalizeCalls: DeploySessionPhaseCall[]
  phase3Calls: DeploySessionPhaseCall[]
  phase4Calls: DeploySessionPhaseCall[]
  hasPhase3: boolean
  hasPhase4: boolean
}): void {
  const phase2PreFinalizeCalls = params.phase2PreFinalizeCalls ?? []
  for (const call of phase2PreFinalizeCalls) {
    const selector = readSelector(call.data)
    if (SELECTOR_FINALIZE_PHASE2.has(selector)) {
      throw new Error(`phase2_pre_finalize_boundary_violation:finalize:${selector}`)
    }
    if (!PHASE2_PRE_FINALIZE_SELECTORS.has(selector)) {
      throw new Error(`phase2_pre_finalize_boundary_violation:${selector}`)
    }
  }
  assertNoPostAuctionCcaCalls(phase2PreFinalizeCalls, 'phase2_pre_finalize')

  for (const call of params.phase2FinalizeCalls) {
    const selector = readSelector(call.data)
    if (!SELECTOR_FINALIZE_PHASE2.has(selector)) {
      throw new Error(`phase2_finalize_boundary_violation:${selector}`)
    }
  }

  assertNoPostAuctionCcaCalls(params.phase2FinalizeCalls, 'phase2_finalize')

  if (params.hasPhase3) {
    assertNoPostAuctionCcaCalls(params.phase3Calls, 'phase3')

    const firstSelector = readSelector(params.phase3Calls[0]?.data ?? ('0x' as Hex))
    if (firstSelector !== SELECTOR_DEPLOY_PHASE3_STRATEGIES) {
      throw new Error('phase3_first_call_invalid')
    }

    let sawDeployToStrategies = false
    for (const call of params.phase3Calls) {
      const selector = readSelector(call.data)
      if (selector === SELECTOR_LAUNCH_DEFERRED_AUCTION) {
        throw new Error('phase3_boundary_violation:launchDeferredAuction')
      }
      if (selector === SELECTOR_DEPLOY_TO_STRATEGIES) {
        sawDeployToStrategies = true
      }
    }
    if (!sawDeployToStrategies) {
      throw new Error('phase3_missing_deploy_to_strategies')
    }
  }

  if (params.hasPhase4) {
    for (const call of params.phase4Calls) {
      const selector = readSelector(call.data)
      if (selector !== SELECTOR_LAUNCH_DEFERRED_AUCTION) {
        throw new Error(`phase4_boundary_violation:${selector}`)
      }
    }

    assertNoPostAuctionCcaCalls(params.phase4Calls, 'phase4')
  }
}
