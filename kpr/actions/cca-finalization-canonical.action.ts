/**
 * Canonical CCA finalization client.
 *
 * Production automation must cross the `/api/keeper/sweep` completion gate.
 * That server path owns hook configuration, completion invariants, and the
 * settledAt transition. The direct on-chain action remains available only for
 * explicitly manual/local diagnostics.
 */

import { CHAINS, requireEnv } from '../config.js'
import {
  executeCcaFinalizationForStrategy,
  readAuctionStateForAddress,
} from './cca-finalization.action.js'
import {
  fetchActiveVaults,
  filterVaultsForWorkflow,
  type VaultConfig,
} from '../utils/registry.js'

type CanonicalCcaResult = {
  ccaLaunchArmAddress: `0x${string}`
  vaultAddress: `0x${string}`
  ok: boolean
  status: number
  completionStage?: string
  error?: string
}

export type CanonicalCcaBatchResult = {
  totalStrategies: number
  processed: number
  settled: number
  skipped: number
  errors: number
  results: CanonicalCcaResult[]
}

function apiBaseUrl(): string {
  return String(process.env.KPR_API_BASE_URL ?? 'https://app.4626.fun/api').trim().replace(/\/$/, '')
}

function buildSweepBody(vault: VaultConfig): Record<string, unknown> | null {
  if (
    !vault.ccaLaunchArmAddress ||
    !vault.shareTokenAddress ||
    !vault.gaugeControllerAddress
  ) {
    return null
  }
  const routerMode = Boolean(vault.payoutRouterAddress && vault.burnStreamAddress)
  return {
    ccaLaunchArmAddress: vault.ccaLaunchArmAddress,
    markSettled: { vaultAddress: vault.vaultAddress },
    invariants: {
      creatorCoinAddress: vault.creatorCoinAddress,
      shareTokenAddress: vault.shareTokenAddress,
      gaugeControllerAddress: vault.gaugeControllerAddress,
      payoutRecipientMode: routerMode ? 'payout_router' : 'gauge',
      ...(vault.oracleAddress ? { oracleAddress: vault.oracleAddress } : {}),
      vaultAddress: vault.vaultAddress,
      ...(vault.payoutRouterAddress ? { payoutRouterAddress: vault.payoutRouterAddress } : {}),
      ...(vault.burnStreamAddress ? { burnStreamAddress: vault.burnStreamAddress } : {}),
    },
  }
}

async function postCanonicalSweep(vault: VaultConfig): Promise<CanonicalCcaResult> {
  const body = buildSweepBody(vault)
  if (!body || !vault.ccaLaunchArmAddress) {
    return {
      ccaLaunchArmAddress:
        vault.ccaLaunchArmAddress ?? '0x0000000000000000000000000000000000000000',
      vaultAddress: vault.vaultAddress,
      ok: false,
      status: 0,
      error: 'missing_canonical_completion_invariants',
    }
  }

  if (String(process.env.DRY_RUN ?? '').trim().toLowerCase() === 'true') {
    return {
      ccaLaunchArmAddress: vault.ccaLaunchArmAddress,
      vaultAddress: vault.vaultAddress,
      ok: true,
      status: 0,
      completionStage: 'dry_run',
    }
  }

  const response = await fetch(`${apiBaseUrl()}/keeper/sweep`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('KPR_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  type SweepPayload = {
    success?: boolean
    error?: string
    data?: { completionStage?: string }
  }
  let payload: SweepPayload | null
  try {
    payload = text ? JSON.parse(text) as SweepPayload : null
  } catch {
    payload = null
  }
  return {
    ccaLaunchArmAddress: vault.ccaLaunchArmAddress,
    vaultAddress: vault.vaultAddress,
    ok: response.ok && payload?.success === true,
    status: response.status,
    ...(payload?.data?.completionStage
      ? { completionStage: payload.data.completionStage }
      : {}),
    ...(!response.ok || payload?.success !== true
      ? { error: payload?.error ?? `keeper_sweep_http_${response.status}` }
      : {}),
  }
}

export async function executeCanonicalCcaFinalization(): Promise<CanonicalCcaBatchResult> {
  const vaults = filterVaultsForWorkflow(
    await fetchActiveVaults(CHAINS.base.id),
    'cca-finalization',
  )
  const results: CanonicalCcaResult[] = []
  for (const vault of vaults) {
    try {
      const ccaLaunchArmAddress = vault.ccaLaunchArmAddress
      if (!ccaLaunchArmAddress) {
        results.push({
          ccaLaunchArmAddress: '0x0000000000000000000000000000000000000000',
          vaultAddress: vault.vaultAddress,
          ok: false,
          status: 0,
          error: 'missing_cca_launch_arm',
        })
        continue
      }

      // Failed auctions never graduate — `/keeper/sweep` only covers the graduated
      // path. Preserve finalizeFailedAuction via the direct strategy action.
      const state = await readAuctionStateForAddress(ccaLaunchArmAddress)
      if (state.hasActiveAuction && !state.isGraduated) {
        const failedPath = await executeCcaFinalizationForStrategy(ccaLaunchArmAddress)
        results.push({
          ccaLaunchArmAddress,
          vaultAddress: vault.vaultAddress,
          ok: failedPath.failedFinalized || Boolean(failedPath.skippedReason),
          status: failedPath.failedFinalized ? 200 : 0,
          completionStage: failedPath.failedFinalized
            ? 'failed_finalized'
            : failedPath.skippedReason ?? 'not_graduated',
          ...(!failedPath.failedFinalized && !failedPath.skippedReason
            ? { error: failedPath.failedFinalizeResult?.error ?? 'finalize_failed_auction_unsuccessful' }
            : {}),
        })
        continue
      }

      results.push(await postCanonicalSweep(vault))
    } catch (error) {
      results.push({
        ccaLaunchArmAddress:
          vault.ccaLaunchArmAddress ?? '0x0000000000000000000000000000000000000000',
        vaultAddress: vault.vaultAddress,
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'canonical_sweep_failed',
      })
    }
  }
  return {
    totalStrategies: vaults.length,
    processed: results.length,
    settled: results.filter(
      (row) => row.ok && (row.completionStage === 'completed' || row.completionStage === 'failed_finalized'),
    ).length,
    skipped: results.filter(
      (row) =>
        row.ok &&
        row.completionStage !== 'completed' &&
        row.completionStage !== 'failed_finalized',
    ).length,
    errors: results.filter((row) => !row.ok).length,
    results,
  }
}

export const __testHooks = { buildSweepBody }
