/**
 * CRE Workflow: CCA Finalization (Smart Polling)
 *
 * Graduation is a one-time event ~7 days after vault deployment. This
 * workflow runs hourly (not every 5 min) and only fetches vaults that
 * have NOT been marked as settled in the DB.
 *
 * Flow:
 *   1. HTTP: GET /cre/vaults/active?settled=false&chainId=<configured-chain>
 *   2. EVM:  currentAuction(), isGraduated(), sweepCurrencyBlock()
 *   3. HTTP: POST /cre/keeper/sweep (canonical completion attempt + invariant gate)
 *   4. HTTP: POST /cre/keeper/mark-settled (record timestamps + settlement stage)
 *
 * CRE Quota Budget per execution:
 *   - 1 HTTP (fetch unsettled vaults)
 *   - 3 EVM reads (currentAuction, isGraduated, sweepCurrencyBlock)
 *   - 1 HTTP (sweep) — only if needed
 *   - 1 HTTP (mark-settled) — only if state changed
 *   Total: max 3 HTTP + 3 EVM reads (well within CRE limits)
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
import { decodeFunctionResult, zeroAddress } from "viem"
import { CCAStrategyABI, CCAAuctionABI } from "../contracts/abi"
import { createEvmClientForChain, readContractBytes, resolveChainId } from "../_shared/evm"
import { getJson, postJson } from "../_shared/http"
import { tryNativeWriteReport } from "../_shared/nativeWrite"
import { selectRotatingItems } from "../_shared/rotation"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

type Config = {
  schedule: string
  apiBaseUrl: string
  chainName: string
  chainId?: number
  maxVaultsPerExecution?: number
  rotationIntervalSeconds?: number
  enableKeeperHookConfig?: boolean
  enforceCompletionInvariants?: boolean
  expectedPayoutRecipientMode?: "gauge" | "payout_router"
  nativeWriteEnabled?: boolean
  nativeReceiver?: `0x${string}`
  nativeEncoderName?: string
  nativeSigningAlgo?: string
  nativeHashingAlgo?: string
  nativeGasLimit?: string
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VaultInfo = {
  vaultAddress: string
  chainId: number
  creatorCoinAddress?: string
  shareTokenAddress?: string
  ccaStrategyAddress?: string
  gaugeControllerAddress?: string
  burnStreamAddress?: string
  payoutRouterAddress?: string
  graduatedAt?: string | null
  settledAt?: string | null
}

type SettlementResult = {
  vaultAddress: string
  ccaStrategyAddress: string
  auctionAddress: string
  graduated: boolean
  alreadySwept: boolean
  swept: boolean
  completionStage: string
  completionCompleted: boolean
  markedSettled: boolean
  skippedReason: string
  error: string
}

type SweepCompletionPayload = {
  sweepStatus?: string
  migrateStatus?: string
  hookConfigStatus?: string
  completionStage?: string
  completed?: boolean
}

type CompletionInvariantPayload = {
  creatorCoinAddress?: string
  shareTokenAddress?: string
  gaugeControllerAddress?: string
  burnStreamAddress?: string
  payoutRouterAddress?: string
  payoutRecipientMode?: "gauge" | "payout_router"
}

// ---------------------------------------------------------------------------
// EVM read helpers
// ---------------------------------------------------------------------------

function readContractField(
  runtime: Runtime<Config>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  address: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  functionName: string,
): Uint8Array {
  return readContractBytes(runtime, evmClient, {
    address,
    abi,
    functionName,
  })
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function fetchUnsettledVaults(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  chainId: number,
): string {
  const body = getJson<Config, { success: boolean; data?: { vaults: VaultInfo[] } }>(
    nodeRuntime,
    httpClient,
    apiKey,
    `/cre/vaults/active?settled=false&chainId=${chainId}`,
  )
  return JSON.stringify(body.success && body.data ? body.data.vaults : [])
}

function sendSweepRequest(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  ccaStrategyAddress: string,
  attemptHookConfig: boolean,
  enforceInvariants: boolean,
  invariants: CompletionInvariantPayload,
): { ok: boolean; payload: SweepCompletionPayload } {
  const body = postJson<Config, { success: boolean; data?: SweepCompletionPayload }>(
    nodeRuntime,
    httpClient,
    apiKey,
    "/cre/keeper/sweep",
    { ccaStrategyAddress, attemptHookConfig, enforceInvariants, invariants },
  )
  return {
    ok: body.success,
    payload: body.data ?? {},
  }
}

function markSettled(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  vaultAddress: string,
  graduatedAt?: string,
  settledAt?: string,
  settlementStage?: string,
): boolean {
  const payload: Record<string, string> = { vaultAddress }
  if (graduatedAt) payload.graduatedAt = graduatedAt
  if (settledAt) payload.settledAt = settledAt
  if (settlementStage) payload.settlementStage = settlementStage

  const body = postJson<Config, { success: boolean }>(
    nodeRuntime,
    httpClient,
    apiKey,
    "/cre/keeper/mark-settled",
    payload,
  )
  return body.success
}

// ---------------------------------------------------------------------------
// CRE Callback
// ---------------------------------------------------------------------------

const onCronTrigger = (runtime: Runtime<Config>): SettlementResult => {
  const apiKeySecret = runtime.getSecret({ id: "KEEPR_API_KEY" }).result()
  const apiKey = apiKeySecret.value
  const chainId = resolveChainId(runtime.config.chainName, runtime.config.chainId)

  runtime.log("CCA finalization (smart polling) starting")

  // Step 1: Fetch only unsettled vaults
  const httpClient = new HTTPClient()
  const vaultsJson = runtime.runInNodeMode(
    (nr: NodeRuntime<Config>) => fetchUnsettledVaults(nr, httpClient, apiKey, chainId),
    consensusIdenticalAggregation(),
  )().result()
  const vaults = JSON.parse(vaultsJson) as VaultInfo[]

  const eligibleVaults = vaults
    .filter((v) => v.ccaStrategyAddress)
    .sort((a, b) => a.vaultAddress.localeCompare(b.vaultAddress))
  const selected = selectRotatingItems(eligibleVaults, {
    now: runtime.now(),
    rotationIntervalSeconds: runtime.config.rotationIntervalSeconds ?? 3600,
    maxItems: runtime.config.maxVaultsPerExecution ?? 1,
  })
  const vault = selected[0]
  if (!vault || !vault.ccaStrategyAddress) {
    runtime.log("No unsettled vaults with CCA strategy found")
    return {
      vaultAddress: "",
      ccaStrategyAddress: "",
      auctionAddress: "",
      graduated: false,
      alreadySwept: false,
      swept: false,
      completionStage: "none",
      completionCompleted: false,
      markedSettled: false,
      skippedReason: "no_unsettled_cca_vaults",
      error: "",
    }
  }

  const ccaAddr = vault.ccaStrategyAddress
  runtime.log(`Processing CCA strategy ${ccaAddr} for vault ${vault.vaultAddress}`)

  // Step 2: Read auction state via EVMClient
  const evmClient = createEvmClientForChain(runtime.config.chainName)

  // Read currentAuction()
  const auctionData = readContractField(runtime, evmClient, ccaAddr, CCAStrategyABI, "currentAuction")
  const auctionAddress = decodeFunctionResult({
    abi: CCAStrategyABI,
    functionName: "currentAuction",
    data: bytesToHex(auctionData),
  }) as `0x${string}`

  if (auctionAddress === zeroAddress) {
    runtime.log("No active auction — skipping")
    return {
      vaultAddress: vault.vaultAddress,
      ccaStrategyAddress: ccaAddr,
      auctionAddress: zeroAddress,
      graduated: false,
      alreadySwept: false,
      swept: false,
      completionStage: "not_applicable",
      completionCompleted: false,
      markedSettled: false,
      skippedReason: "no_active_auction",
      error: "",
    }
  }

  // Read isGraduated()
  const graduatedData = readContractField(runtime, evmClient, auctionAddress, CCAAuctionABI, "isGraduated")
  const isGraduated = decodeFunctionResult({
    abi: CCAAuctionABI,
    functionName: "isGraduated",
    data: bytesToHex(graduatedData),
  }) as boolean

  if (!isGraduated) {
    runtime.log(`Auction ${auctionAddress} not yet graduated — skipping`)
    return {
      vaultAddress: vault.vaultAddress,
      ccaStrategyAddress: ccaAddr,
      auctionAddress,
      graduated: false,
      alreadySwept: false,
      swept: false,
      completionStage: "not_graduated",
      completionCompleted: false,
      markedSettled: false,
      skippedReason: "not_graduated",
      error: "",
    }
  }

  // Read sweepCurrencyBlock() — if non-zero, already swept on-chain
  const sweepBlockData = readContractField(runtime, evmClient, auctionAddress, CCAAuctionABI, "sweepCurrencyBlock")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sweepCurrencyBlock = decodeFunctionResult({ abi: CCAAuctionABI, functionName: "sweepCurrencyBlock", data: bytesToHex(sweepBlockData) } as any) as bigint

  const nowIso = new Date().toISOString()

  // Step 3: Graduated — attempt canonical completion
  runtime.log(`Auction ${auctionAddress} graduated — attempting canonical completion`)

  // Record graduation timestamp
  runtime.runInNodeMode(
    (nr: NodeRuntime<Config>) =>
      markSettled(nr, httpClient, apiKey, vault.vaultAddress, nowIso, undefined, "graduated_detected"),
    consensusIdenticalAggregation(),
  )().result()

  const alreadySwept = sweepCurrencyBlock > 0n
  const nativeSweep = alreadySwept
    ? { attempted: false, success: false, txHash: undefined as string | undefined, error: undefined as string | undefined }
    : tryNativeWriteReport(runtime, evmClient, {
        action: "sweep",
        ccaStrategyAddress: ccaAddr,
        vaultAddress: vault.vaultAddress,
        timestamp: nowIso,
      })

  if (nativeSweep.success) {
    runtime.log(`Native sweep write succeeded${nativeSweep.txHash ? ` tx=${nativeSweep.txHash}` : ""}`)
  } else if (nativeSweep.attempted) {
    runtime.log(
      `Native sweep write failed, falling back to HTTP bridge (${nativeSweep.error ?? "unknown_error"})`,
    )
  } else if (alreadySwept) {
    runtime.log(`Auction already swept on-chain at block ${sweepCurrencyBlock}`)
  }

  let completion
  try {
    const completionInvariants: CompletionInvariantPayload = {
      ...(vault.creatorCoinAddress ? { creatorCoinAddress: vault.creatorCoinAddress } : {}),
      ...(vault.shareTokenAddress ? { shareTokenAddress: vault.shareTokenAddress } : {}),
      ...(vault.gaugeControllerAddress ? { gaugeControllerAddress: vault.gaugeControllerAddress } : {}),
      ...(vault.burnStreamAddress ? { burnStreamAddress: vault.burnStreamAddress } : {}),
      ...(vault.payoutRouterAddress ? { payoutRouterAddress: vault.payoutRouterAddress } : {}),
      payoutRecipientMode: runtime.config.expectedPayoutRecipientMode === "payout_router" ? "payout_router" : "gauge",
    }

    completion = runtime.runInNodeMode(
      (nr: NodeRuntime<Config>) =>
        sendSweepRequest(
          nr,
          httpClient,
          apiKey,
          ccaAddr,
          Boolean(runtime.config.enableKeeperHookConfig),
          runtime.config.enforceCompletionInvariants !== false,
          completionInvariants,
        ),
      consensusIdenticalAggregation(),
    )().result()
  } catch (err) {
    const message = err instanceof Error ? err.message : "completion_request_failed"
    runtime.log(`Canonical completion request failed (${message})`)
    runtime.runInNodeMode(
      (nr: NodeRuntime<Config>) =>
        markSettled(nr, httpClient, apiKey, vault.vaultAddress, undefined, undefined, "completion_request_failed"),
      consensusIdenticalAggregation(),
    )().result()
    return {
      vaultAddress: vault.vaultAddress,
      ccaStrategyAddress: ccaAddr,
      auctionAddress,
      graduated: true,
      alreadySwept,
      swept: nativeSweep.success || alreadySwept,
      completionStage: "completion_request_failed",
      completionCompleted: false,
      markedSettled: false,
      skippedReason: "",
      error: message,
    }
  }

  const completionStage = completion.payload.completionStage ?? (completion.ok ? "in_progress" : "completion_failed")
  const completionCompleted = completion.ok && completion.payload.completed === true
  const sweepStatus = String(completion.payload.sweepStatus ?? "")
  const swept = alreadySwept || nativeSweep.success || sweepStatus === "success" || sweepStatus === "already_done"

  let markedSettled = false
  if (completionCompleted) {
    runtime.log("Completion succeeded — marking vault as settled")
    markedSettled = runtime.runInNodeMode(
      (nr: NodeRuntime<Config>) =>
        markSettled(nr, httpClient, apiKey, vault.vaultAddress, undefined, nowIso, "completed"),
      consensusIdenticalAggregation(),
    )().result()
  } else {
    runtime.log(`Completion pending (${completionStage}) — preserving unsettled state`)
    runtime.runInNodeMode(
      (nr: NodeRuntime<Config>) =>
        markSettled(nr, httpClient, apiKey, vault.vaultAddress, undefined, undefined, completionStage),
      consensusIdenticalAggregation(),
    )().result()
  }

  return {
    vaultAddress: vault.vaultAddress,
    ccaStrategyAddress: ccaAddr,
    auctionAddress,
    graduated: true,
    alreadySwept,
    swept,
    completionStage,
    completionCompleted,
    markedSettled,
    skippedReason: "",
    error: completion.ok ? "" : "completion_failed",
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
