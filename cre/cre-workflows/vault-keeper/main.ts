/**
 * CRE Workflow: Vault Keeper
 *
 * Reads vault state from Base mainnet via EVMClient, evaluates whether
 * tend() or report() should be called, and delegates the write to the
 * Vercel API HTTP bridge.
 *
 * CRE Quota Budget per execution:
 *   - 1 HTTP call: GET /vaults/active (fetch active vault set)
 *   - Up to 10 EVM reads: vault state fields (coinBalance, deploymentThreshold, etc.)
 *   - Up to 2 HTTP calls: POST /keeper/tend and/or POST /keeper/report
 *   Total: 3 HTTP calls + 10 EVM reads (within CRE limits)
 *
 * Processes 1 rotating vault per execution. Runs every 5 minutes.
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
import { VaultABI } from "../contracts/abi"
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
  reportIntervalSeconds: number
  rotationIntervalSeconds?: number
  nativeWriteEnabled?: boolean
  nativeReceiver?: `0x${string}`
  nativeEncoderName?: string
  nativeSigningAlgo?: string
  nativeHashingAlgo?: string
  nativeGasLimit?: string
  rpcReadRetryAttempts?: number
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VaultInfo = {
  vaultAddress: string
  chainId: number
}

type VaultState = {
  coinBalance: bigint
  deploymentThreshold: bigint
  minimumTotalIdle: bigint
  totalStrategyWeight: bigint
  lastReport: bigint
  isShutdown: boolean
  paused: boolean
  totalAssets: bigint
}

type KeeperResult = {
  vaultAddress: string
  tended: boolean
  reported: boolean
  skippedReason: string
  error: string
  metrics: {
    retryCount: number
    rateLimited: boolean
    tendExecutionPath: "none" | "native_success" | "bridge_success" | "bridge_failed"
    reportExecutionPath: "none" | "native_success" | "bridge_success" | "bridge_failed"
  }
}

// ---------------------------------------------------------------------------
// EVM read helpers
// ---------------------------------------------------------------------------

type VaultReadFn = typeof VaultABI[number]["name"]

function readVaultField(
  runtime: Runtime<Config>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  vaultAddress: string,
  functionName: VaultReadFn,
  onRetry?: (attempt: number, error: unknown) => void,
): Uint8Array {
  return readContractBytes(runtime, evmClient, {
    address: vaultAddress,
    abi: VaultABI,
    functionName,
    retryAttempts: runtime.config.rpcReadRetryAttempts ?? 3,
    onRetry,
  })
}

function decodeBigInt(data: Uint8Array, functionName: VaultReadFn): bigint {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return decodeFunctionResult({ abi: VaultABI, functionName, data: bytesToHex(data) } as any) as bigint
}

function decodeBool(data: Uint8Array, functionName: VaultReadFn): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return decodeFunctionResult({ abi: VaultABI, functionName, data: bytesToHex(data) } as any) as boolean
}

function isRpcRateLimitedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /429|too many requests|rate limit|over rate limit|-32016/i.test(message)
}

// ---------------------------------------------------------------------------
// Decision logic (pure computation — no CRE quota cost)
// ---------------------------------------------------------------------------

function shouldTend(state: VaultState): boolean {
  if (state.isShutdown || state.paused) return false
  if (state.totalStrategyWeight === 0n) return false

  const minIdle =
    state.minimumTotalIdle > state.deploymentThreshold
      ? state.minimumTotalIdle
      : state.deploymentThreshold

  return state.coinBalance > minIdle
}

function shouldReport(
  state: VaultState,
  reportIntervalSeconds: number,
  nowSeconds: bigint,
): boolean {
  if (state.isShutdown || state.paused) return false
  if (state.totalStrategyWeight === 0n) return false

  const secondsSinceReport = nowSeconds - state.lastReport
  return secondsSinceReport > BigInt(reportIntervalSeconds)
}

// ---------------------------------------------------------------------------
// HTTP helper — fetch vault list (runs in node mode)
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
    `/vaults/active?chainId=${chainId}`,
  )
  return body.success && body.data ? body.data.vaults : []
}

// ---------------------------------------------------------------------------
// HTTP helper — send write request via bridge (runs in node mode)
// ---------------------------------------------------------------------------

function sendBridgeRequest(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  endpoint: string,
  payload: Record<string, string>,
): boolean {
  const body = postJson<Config, { success: boolean }>(
    nodeRuntime,
    httpClient,
    apiKey,
    `/keeper/${endpoint}`,
    payload,
  )
  return body.success
}

// ---------------------------------------------------------------------------
// CRE Callback
// ---------------------------------------------------------------------------

const onCronTrigger = (runtime: Runtime<Config>): KeeperResult => {
  const apiKeySecret = runtime.getSecret({ id: "KEEPR_API_KEY" }).result()
  const apiKey = apiKeySecret.value
  const chainId = resolveChainId(runtime.config.chainName, runtime.config.chainId)

  runtime.log("Vault keeper starting")

  // Step 1: Fetch vault list via HTTP
  const httpClient = new HTTPClient()
  const vaults = runtime.runInNodeMode(
    (nr: NodeRuntime<Config>) => fetchVaults(nr, httpClient, apiKey, chainId),
    consensusIdenticalAggregation(),
  )().result()

  if (vaults.length === 0) {
    runtime.log("No vaults found")
    return {
      vaultAddress: "",
      tended: false,
      reported: false,
      skippedReason: "no_vaults",
      error: "",
      metrics: {
        retryCount: 0,
        rateLimited: false,
        tendExecutionPath: "none",
        reportExecutionPath: "none",
      },
    }
  }

  const selected = selectRotatingItems(
    [...vaults].sort((a, b) => a.vaultAddress.localeCompare(b.vaultAddress)),
    {
      now: runtime.now(),
      rotationIntervalSeconds: runtime.config.rotationIntervalSeconds ?? 300,
      maxItems: 1,
    },
  )
  const vault = selected[0]
  if (!vault) {
    runtime.log("No selected vaults after rotation")
    return {
      vaultAddress: "",
      tended: false,
      reported: false,
      skippedReason: "no_selected_vaults",
      error: "",
      metrics: {
        retryCount: 0,
        rateLimited: false,
        tendExecutionPath: "none",
        reportExecutionPath: "none",
      },
    }
  }

  const addr = vault.vaultAddress
  runtime.log(`Processing vault ${addr}`)

  // Step 2: Read vault state via EVMClient
  const evmClient = createEvmClientForChain(runtime.config.chainName)
  let rpcRetryCount = 0
  const onReadRetry = () => {
    rpcRetryCount += 1
  }

  let state: VaultState
  try {
    const coinBalanceData = readVaultField(runtime, evmClient, addr, "coinBalance", onReadRetry)
    const deploymentThresholdData = readVaultField(
      runtime,
      evmClient,
      addr,
      "deploymentThreshold",
      onReadRetry,
    )
    const minimumTotalIdleData = readVaultField(
      runtime,
      evmClient,
      addr,
      "minimumTotalIdle",
      onReadRetry,
    )
    const totalStrategyWeightData = readVaultField(
      runtime,
      evmClient,
      addr,
      "totalStrategyWeight",
      onReadRetry,
    )
    const lastReportData = readVaultField(runtime, evmClient, addr, "lastReport", onReadRetry)
    const isShutdownData = readVaultField(runtime, evmClient, addr, "isShutdown", onReadRetry)
    const pausedData = readVaultField(runtime, evmClient, addr, "paused", onReadRetry)
    const totalAssetsData = readVaultField(runtime, evmClient, addr, "totalAssets", onReadRetry)

    state = {
      coinBalance: decodeBigInt(coinBalanceData, "coinBalance"),
      deploymentThreshold: decodeBigInt(deploymentThresholdData, "deploymentThreshold"),
      minimumTotalIdle: decodeBigInt(minimumTotalIdleData, "minimumTotalIdle"),
      totalStrategyWeight: decodeBigInt(totalStrategyWeightData, "totalStrategyWeight"),
      lastReport: decodeBigInt(lastReportData, "lastReport"),
      isShutdown: decodeBool(isShutdownData, "isShutdown"),
      paused: decodeBool(pausedData, "paused"),
      totalAssets: decodeBigInt(totalAssetsData, "totalAssets"),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isRpcRateLimitedError(error)) {
      runtime.log(`RPC rate-limited while reading ${addr}; skipping this run`)
      return {
        vaultAddress: addr,
        tended: false,
        reported: false,
        skippedReason: "rpc_rate_limited",
        error: "",
        metrics: {
          retryCount: rpcRetryCount,
          rateLimited: true,
          tendExecutionPath: "none",
          reportExecutionPath: "none",
        },
      }
    }
    runtime.log(`Vault read failed for ${addr}: ${message}`)
    return {
      vaultAddress: addr,
      tended: false,
      reported: false,
      skippedReason: "evm_read_failed",
      error: message,
      metrics: {
        retryCount: rpcRetryCount,
        rateLimited: false,
        tendExecutionPath: "none",
        reportExecutionPath: "none",
      },
    }
  }

  // Guard: vault is shutdown or paused
  if (state.isShutdown) {
    runtime.log(`Vault ${addr} is shutdown — skipping`)
    return {
      vaultAddress: addr,
      tended: false,
      reported: false,
      skippedReason: "vault_shutdown",
      error: "",
      metrics: {
        retryCount: rpcRetryCount,
        rateLimited: false,
        tendExecutionPath: "none",
        reportExecutionPath: "none",
      },
    }
  }
  if (state.paused) {
    runtime.log(`Vault ${addr} is paused — skipping`)
    return {
      vaultAddress: addr,
      tended: false,
      reported: false,
      skippedReason: "vault_paused",
      error: "",
      metrics: {
        retryCount: rpcRetryCount,
        rateLimited: false,
        tendExecutionPath: "none",
        reportExecutionPath: "none",
      },
    }
  }

  // Step 3: Decision logic
  const nowSeconds = BigInt(Math.floor(runtime.now().getTime() / 1000))
  const needsTend = shouldTend(state)
  const needsReport = shouldReport(state, runtime.config.reportIntervalSeconds, nowSeconds)

  let tended = false
  let reported = false
  let tendExecutionPath: KeeperResult["metrics"]["tendExecutionPath"] = "none"
  let reportExecutionPath: KeeperResult["metrics"]["reportExecutionPath"] = "none"

  // Step 4: Execute writes via native report path (prototype) with HTTP fallback
  if (needsTend) {
    const nativeTend = tryNativeWriteReport(runtime, evmClient, {
      action: "tend",
      vaultAddress: addr,
      timestamp: runtime.now().toISOString(),
    })
    if (nativeTend.success) {
      tended = true
      tendExecutionPath = "native_success"
      runtime.log(`Native tend write succeeded${nativeTend.txHash ? ` tx=${nativeTend.txHash}` : ""}`)
    } else {
      if (nativeTend.attempted) {
        runtime.log(
          `Native tend write failed, falling back to HTTP bridge (${nativeTend.error ?? "unknown_error"})`,
        )
      } else {
        runtime.log(`Calling tend() for ${addr} via HTTP bridge`)
      }
      tended = runtime.runInNodeMode(
        (nr: NodeRuntime<Config>) =>
          sendBridgeRequest(nr, httpClient, apiKey, "tend", { vaultAddress: addr }),
        consensusIdenticalAggregation(),
      )().result()
      tendExecutionPath = tended ? "bridge_success" : "bridge_failed"
    }
    runtime.log(`tend() ${tended ? "succeeded" : "failed"}`)
  }

  if (needsReport) {
    const nativeReport = tryNativeWriteReport(runtime, evmClient, {
      action: "report",
      vaultAddress: addr,
      timestamp: runtime.now().toISOString(),
    })
    if (nativeReport.success) {
      reported = true
      reportExecutionPath = "native_success"
      runtime.log(
        `Native report write succeeded${nativeReport.txHash ? ` tx=${nativeReport.txHash}` : ""}`,
      )
    } else {
      if (nativeReport.attempted) {
        runtime.log(
          `Native report write failed, falling back to HTTP bridge (${nativeReport.error ?? "unknown_error"})`,
        )
      } else {
        runtime.log(`Calling report() for ${addr} via HTTP bridge`)
      }
      reported = runtime.runInNodeMode(
        (nr: NodeRuntime<Config>) =>
          sendBridgeRequest(nr, httpClient, apiKey, "report", { vaultAddress: addr }),
        consensusIdenticalAggregation(),
      )().result()
      reportExecutionPath = reported ? "bridge_success" : "bridge_failed"
    }
    runtime.log(`report() ${reported ? "succeeded" : "failed"}`)
  }

  if (!needsTend && !needsReport) {
    runtime.log(`No action needed for ${addr}`)
  }

  return {
    vaultAddress: addr,
    tended,
    reported,
    skippedReason: "",
    error: "",
    metrics: {
      retryCount: rpcRetryCount,
      rateLimited: false,
      tendExecutionPath,
      reportExecutionPath,
    },
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
