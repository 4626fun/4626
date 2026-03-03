/**
 * CRE Workflow: Payout Integrity Monitor
 *
 * Runs every 30 minutes and verifies the full fee pipeline for each vault:
 *
 *   1. payoutRecipient check — Creator Coin's payoutRecipient == GaugeController
 *   2. GaugeController BPS config — burnShareBps + lotteryShareBps + creatorShareBps + protocolShareBps == 10000
 *   3. GaugeController wiring — vault() matches the registered vault address
 *   4. Burn stream health — activeShares dripping, not stale
 *   5. GaugeController balance — holds vault shares, lastDistribution not stale
 *
 * On failure: alerts via POST /cre/keeper/alert
 *
 * CRE Quota Budget per execution (1 vault):
 *   - 1 HTTP (fetch vaults)
 *   - ~10 EVM reads (payoutRecipient, BPS x4, vault, lastDistribution,
 *     burnStream x3, balanceOf)
 *   - 1 HTTP (alert if needed)
 *   Total: max 2 HTTP + 10 EVM reads
 */

import {
  CronCapability,
  HTTPClient,
  handler,
  Runner,
  type Runtime,
  type NodeRuntime,
  bytesToHex,
  consensusIdenticalAggregation,
} from "@chainlink/cre-sdk"
import { decodeFunctionResult } from "viem"
import { GaugeControllerABI } from "../contracts/abi/GaugeController"
import { BurnStreamABI } from "../contracts/abi/BurnStream"
import { CreatorCoinABI } from "../contracts/abi/CreatorCoin"
import { ERC20ABI } from "../contracts/abi/ERC20"
import {
  createAiFallbackResult,
  normalizeAiResult,
  type PayoutIntegrityAlertLike,
  type PayoutIntegrityAiResult,
} from "../../utils/payoutIntegrityAi.js"
import { createEvmClientForChain, readContractBytes, resolveChainId } from "../_shared/evm"
import { getJson, postJson } from "../_shared/http"
import { selectRotatingItems } from "../_shared/rotation"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Config = {
  schedule: string
  apiBaseUrl: string
  chainName: string
  chainId?: number
  expectedBurnShareBps: number
  expectedLotteryShareBps: number
  expectedCreatorShareBps: number
  expectedProtocolShareBps: number
  staleThresholdSeconds: number
  rotationIntervalSeconds?: number
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VaultInfo = {
  vaultAddress: string
  chainId: number
  creatorCoinAddress: string
  gaugeControllerAddress?: string
  burnStreamAddress?: string
  groupId: string
}

type AlertInfo = {
  vaultAddress: string
  alertType: string
  severity: "info" | "warning" | "critical"
  message: string
  details: Record<string, unknown>
}

type MonitorResult = {
  vaultAddress: string
  checksRun: number
  alertsSent: number
  alerts: string[]
  aiEnabled: boolean
  aiVerdict: string
  aiConfidence: number
  aiSummary: string
  aiSuggestedAction: string
  aiProvider?: string
  error: string
}

type ConsensusAiAssessment = {
  enabled: boolean
  verdict: string
  confidence: number
  summary: string
  suggestedAction: string
  provider?: string
}

// ---------------------------------------------------------------------------
// EVM read helper
// ---------------------------------------------------------------------------

function evmRead(
  runtime: Runtime<Config>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  address: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  functionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: any[],
): Uint8Array {
  return readContractBytes(runtime, evmClient, {
    address,
    abi,
    functionName,
    args,
    fallbackToLatest: true,
  })
}

function decodeBigInt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  functionName: string,
  data: Uint8Array,
): bigint {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return decodeFunctionResult({ abi, functionName, data: bytesToHex(data) } as any) as bigint
}

function decodeAddress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  functionName: string,
  data: Uint8Array,
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return decodeFunctionResult({ abi, functionName, data: bytesToHex(data) } as any) as string
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function fetchVaults(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  chainId: number,
): VaultInfo[] {
  const body = getJson<Config, { success: boolean; data?: { vaults: VaultInfo[] } }>(
    nodeRuntime,
    httpClient,
    apiKey,
    `/cre/vaults/active?chainId=${chainId}`,
  )
  return body.success && body.data ? body.data.vaults : []
}

function sendAlert(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  alert: AlertInfo,
): boolean {
  const body = postJson<Config, { success: boolean }>(
    nodeRuntime,
    httpClient,
    apiKey,
    "/cre/keeper/alert",
    alert,
  )
  return body.success
}

type AiAssessmentRequest = {
  vaultAddress: string
  checksRun: number
  alerts: PayoutIntegrityAlertLike[]
}

function requestAiAssessment(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  request: AiAssessmentRequest,
): PayoutIntegrityAiResult {
  const body = postJson<Config, {
    success: boolean
    data?: unknown
    error?: string
  }>(
    nodeRuntime,
    httpClient,
    apiKey,
    "/cre/keeper/aiAssess",
    request,
  )

  if (!body.success || !body.data) {
    return createAiFallbackResult(request.alerts, body.error ?? "ai_assessment_failed")
  }

  return normalizeAiResult(body.data, request.alerts)
}

function toConsensusAiAssessment(ai: PayoutIntegrityAiResult): ConsensusAiAssessment {
  return {
    enabled: ai.enabled,
    verdict: ai.verdict,
    confidence: ai.confidence ?? -1,
    summary: ai.summary,
    suggestedAction: ai.suggestedAction,
    ...(ai.provider ? { provider: ai.provider } : {}),
  }
}

// ---------------------------------------------------------------------------
// CRE Callback
// ---------------------------------------------------------------------------

const onCronTrigger = (runtime: Runtime<Config>): MonitorResult => {
  const apiKeySecret = runtime.getSecret({ id: "KEEPR_API_KEY" }).result()
  const apiKey = apiKeySecret.value
  const chainId = resolveChainId(runtime.config.chainName, runtime.config.chainId)
  const emptyAi = createAiFallbackResult([])

  runtime.log("Payout integrity monitor starting")

  // Step 1: Fetch all active vaults
  const httpClient = new HTTPClient()
  const allVaults = runtime.runInNodeMode(
    (nr: NodeRuntime<Config>) => fetchVaults(nr, httpClient, apiKey, chainId),
    consensusIdenticalAggregation(),
  )().result()

  const eligibleVaults = allVaults
    .filter((v) => v.gaugeControllerAddress)
    .sort((a, b) => a.vaultAddress.localeCompare(b.vaultAddress))
  const selected = selectRotatingItems(eligibleVaults, {
    now: runtime.now(),
    rotationIntervalSeconds: runtime.config.rotationIntervalSeconds ?? 1800,
    maxItems: 1,
  })
  const vault = selected[0]
  if (!vault || !vault.gaugeControllerAddress) {
    runtime.log("No vaults with GaugeController configured — skipping")
    return {
      vaultAddress: "",
      checksRun: 0,
      alertsSent: 0,
      alerts: [],
      aiEnabled: emptyAi.enabled,
      aiVerdict: emptyAi.verdict,
      aiConfidence: emptyAi.confidence ?? -1,
      aiSummary: emptyAi.summary,
      aiSuggestedAction: emptyAi.suggestedAction,
      ...(emptyAi.provider ? { aiProvider: emptyAi.provider } : {}),
      error: "",
    }
  }

  const gaugeAddr = vault.gaugeControllerAddress
  const vaultAddr = vault.vaultAddress
  const coinAddr = vault.creatorCoinAddress
  const burnStreamAddr = vault.burnStreamAddress

  runtime.log(`Checking payout integrity for vault ${vaultAddr}`)

  const evmClient = createEvmClientForChain(runtime.config.chainName)
  const pendingAlerts: AlertInfo[] = []
  let checksRun = 0

  // -----------------------------------------------------------------------
  // Check 1: payoutRecipient on Creator Coin == GaugeController
  // -----------------------------------------------------------------------
  try {
    const data = evmRead(runtime, evmClient, coinAddr, CreatorCoinABI, "payoutRecipient")
    const payoutRecipient = decodeAddress(CreatorCoinABI, "payoutRecipient", data).toLowerCase()
    checksRun++

    if (payoutRecipient !== gaugeAddr.toLowerCase()) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: "payout_recipient_mismatch",
        severity: "critical",
        message: `Creator Coin payoutRecipient (${payoutRecipient}) != GaugeController (${gaugeAddr})`,
        details: { payoutRecipient, expected: gaugeAddr },
      })
    } else {
      runtime.log("Check 1 PASS: payoutRecipient matches GaugeController")
    }
  } catch {
    runtime.log("Check 1 ERROR: failed to read payoutRecipient")
  }

  // -----------------------------------------------------------------------
  // Check 2: GaugeController BPS config
  // -----------------------------------------------------------------------
  try {
    const burnData = evmRead(runtime, evmClient, gaugeAddr, GaugeControllerABI, "burnShareBps")
    const lotteryData = evmRead(runtime, evmClient, gaugeAddr, GaugeControllerABI, "lotteryShareBps")
    const creatorData = evmRead(runtime, evmClient, gaugeAddr, GaugeControllerABI, "creatorShareBps")
    const protocolData = evmRead(runtime, evmClient, gaugeAddr, GaugeControllerABI, "protocolShareBps")

    const burnBps = Number(decodeBigInt(GaugeControllerABI, "burnShareBps", burnData))
    const lotteryBps = Number(decodeBigInt(GaugeControllerABI, "lotteryShareBps", lotteryData))
    const creatorBps = Number(decodeBigInt(GaugeControllerABI, "creatorShareBps", creatorData))
    const protocolBps = Number(decodeBigInt(GaugeControllerABI, "protocolShareBps", protocolData))
    checksRun++

    const totalBps = burnBps + lotteryBps + creatorBps + protocolBps
    const cfg = runtime.config

    if (totalBps !== 10000) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: "bps_sum_invalid",
        severity: "critical",
        message: `GaugeController BPS sum is ${totalBps}, expected 10000`,
        details: { burnBps, lotteryBps, creatorBps, protocolBps, totalBps },
      })
    } else if (
      burnBps !== cfg.expectedBurnShareBps ||
      lotteryBps !== cfg.expectedLotteryShareBps ||
      creatorBps !== cfg.expectedCreatorShareBps ||
      protocolBps !== cfg.expectedProtocolShareBps
    ) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: "bps_config_changed",
        severity: "warning",
        message: "GaugeController BPS config differs from expected values",
        details: {
          actual: { burnBps, lotteryBps, creatorBps, protocolBps },
          expected: {
            burnBps: cfg.expectedBurnShareBps,
            lotteryBps: cfg.expectedLotteryShareBps,
            creatorBps: cfg.expectedCreatorShareBps,
            protocolBps: cfg.expectedProtocolShareBps,
          },
        },
      })
    } else {
      runtime.log("Check 2 PASS: BPS config correct")
    }
  } catch {
    runtime.log("Check 2 ERROR: failed to read BPS config")
  }

  // -----------------------------------------------------------------------
  // Check 3: GaugeController vault() wiring
  // -----------------------------------------------------------------------
  try {
    const data = evmRead(runtime, evmClient, gaugeAddr, GaugeControllerABI, "vault")
    const gaugeVault = decodeAddress(GaugeControllerABI, "vault", data).toLowerCase()
    checksRun++

    if (gaugeVault !== vaultAddr.toLowerCase()) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: "gauge_vault_mismatch",
        severity: "critical",
        message: `GaugeController vault() (${gaugeVault}) != registered vault (${vaultAddr})`,
        details: { gaugeVault, expected: vaultAddr },
      })
    } else {
      runtime.log("Check 3 PASS: GaugeController vault wiring correct")
    }
  } catch {
    runtime.log("Check 3 ERROR: failed to read GaugeController vault()")
  }

  // -----------------------------------------------------------------------
  // Check 4: Burn stream health (if configured)
  // -----------------------------------------------------------------------
  if (burnStreamAddr) {
    try {
      const activeData = evmRead(runtime, evmClient, burnStreamAddr, BurnStreamABI, "activeShares")
      const burnedData = evmRead(runtime, evmClient, burnStreamAddr, BurnStreamABI, "burnedActive")
      const epochStartData = evmRead(runtime, evmClient, burnStreamAddr, BurnStreamABI, "activeEpochStart")

      const activeShares = decodeBigInt(BurnStreamABI, "activeShares", activeData)
      const burnedActive = decodeBigInt(BurnStreamABI, "burnedActive", burnedData)
      const activeEpochStart = Number(decodeBigInt(BurnStreamABI, "activeEpochStart", epochStartData))
      checksRun++

      const nowSeconds = Math.floor(Date.now() / 1000)
      const staleThreshold = runtime.config.staleThresholdSeconds

      // Flag if activeShares > 0 but epoch started more than staleThreshold ago
      // (drip() hasn't been called or epoch is very old)
      if (activeShares > 0n && activeEpochStart > 0 && (nowSeconds - activeEpochStart) > staleThreshold) {
        pendingAlerts.push({
          vaultAddress: vaultAddr,
          alertType: "burn_stream_stale",
          severity: "warning",
          message: `Burn stream has active shares but epoch started ${nowSeconds - activeEpochStart}s ago (threshold: ${staleThreshold}s)`,
          details: {
            activeShares: activeShares.toString(),
            burnedActive: burnedActive.toString(),
            activeEpochStart,
            staleSince: nowSeconds - activeEpochStart,
          },
        })
      } else {
        runtime.log("Check 4 PASS: Burn stream healthy")
      }
    } catch {
      runtime.log("Check 4 ERROR: failed to read burn stream state")
    }
  } else {
    runtime.log("Check 4 SKIP: No burn stream configured")
  }

  // -----------------------------------------------------------------------
  // Check 5: GaugeController balance + distribution freshness
  // -----------------------------------------------------------------------
  try {
    // Read vault share balance of the GaugeController
    const balData = evmRead(runtime, evmClient, vaultAddr, ERC20ABI, "balanceOf", [gaugeAddr])
    const gaugeBalance = decodeBigInt(ERC20ABI, "balanceOf", balData)

    // Read lastDistribution
    const distData = evmRead(runtime, evmClient, gaugeAddr, GaugeControllerABI, "lastDistribution")
    const lastDistribution = Number(decodeBigInt(GaugeControllerABI, "lastDistribution", distData))
    checksRun++

    const nowSeconds = Math.floor(Date.now() / 1000)
    const staleThreshold = runtime.config.staleThresholdSeconds

    if (gaugeBalance > 0n && lastDistribution > 0 && (nowSeconds - lastDistribution) > staleThreshold) {
      pendingAlerts.push({
        vaultAddress: vaultAddr,
        alertType: "gauge_distribution_stale",
        severity: "warning",
        message: `GaugeController holds ${gaugeBalance.toString()} vault shares but lastDistribution was ${nowSeconds - lastDistribution}s ago`,
        details: {
          gaugeBalance: gaugeBalance.toString(),
          lastDistribution,
          staleSince: nowSeconds - lastDistribution,
        },
      })
    } else {
      runtime.log("Check 5 PASS: GaugeController balance/distribution OK")
    }
  } catch {
    runtime.log("Check 5 ERROR: failed to read GaugeController balance")
  }

  // -----------------------------------------------------------------------
  // AI-assisted classification (advisory only; deterministic checks remain authoritative)
  // -----------------------------------------------------------------------
  const aiAssessment = runtime.runInNodeMode(
    (nr: NodeRuntime<Config>) =>
      toConsensusAiAssessment(
        requestAiAssessment(nr, httpClient, apiKey, {
          vaultAddress: vaultAddr,
          checksRun,
          alerts: pendingAlerts,
        }),
      ),
    consensusIdenticalAggregation(),
  )().result()

  runtime.log(
    `AI assessment: enabled=${aiAssessment.enabled} verdict=${aiAssessment.verdict} confidence=${aiAssessment.confidence >= 0 ? aiAssessment.confidence : "n/a"}`,
  )

  // -----------------------------------------------------------------------
  // Send alerts
  // -----------------------------------------------------------------------
  let alertsSent = 0
  if (pendingAlerts.length > 0) {
    runtime.log(`Sending ${pendingAlerts.length} alert(s)`)
    for (const alert of pendingAlerts) {
      const sent = runtime.runInNodeMode(
        (nr: NodeRuntime<Config>) => sendAlert(nr, httpClient, apiKey, alert),
        consensusIdenticalAggregation(),
      )().result()
      if (sent) alertsSent++
    }
  } else {
    runtime.log("All checks passed — no alerts")
  }

  return {
    vaultAddress: vaultAddr,
    checksRun,
    alertsSent,
    alerts: pendingAlerts.map((a) => `[${a.severity}] ${a.alertType}: ${a.message}`),
    aiEnabled: aiAssessment.enabled,
    aiVerdict: aiAssessment.verdict,
    aiConfidence: aiAssessment.confidence,
    aiSummary: aiAssessment.summary,
    aiSuggestedAction: aiAssessment.suggestedAction,
    ...(aiAssessment.provider ? { aiProvider: aiAssessment.provider } : {}),
    error: "",
  }
}

// ---------------------------------------------------------------------------
// Workflow definition
// ---------------------------------------------------------------------------

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
