import { HTTPClient, type Runtime, type NodeRuntime, bytesToHex, consensusIdenticalAggregation } from "@chainlink/cre-sdk"
import { decodeFunctionResult, zeroAddress } from "viem"
import {
  AjnaPoolViewABI,
  AjnaAdapterViewABI,
  AjnaAuthViewABI,
  AjnaInnerVaultViewABI,
  OracleStrategyViewABI,
  VaultStrategyViewABI,
} from "../contracts/abi"
import {
  bucketPriceChangeBps,
  computeSteppedBucket,
  deriveAjnaBucketFromV3Tick,
  pickBestLiquidityBucket,
} from "./strategyMath"
import {
  type ActiveVaultConfig,
  enqueueStrategyAction,
  fetchActiveVaults,
} from "./strategyQueue"
import { createEvmClientForChain, readContractBytes, resolveChainId } from "./evm"
import { selectRotatingItems } from "./rotation"

export type AjnaManagerConfig = {
  apiBaseUrl: string
  chainName: string
  chainId?: number
  twapDuration: number
  targetLtvBps: number
  priceChangeTriggerBps: number
  moveThreshold: number
  maxStep: number
  liquiditySearchRadius: number
  maxVaultsPerExecution: number
  maxStrategiesPerVault: number
  rotationIntervalSeconds: number
}

export type AjnaManualPayload = {
  vaultAddress?: string
  maxVaultsPerExecution?: number
  forceEnqueue?: boolean
  authToken?: string
  strategyAddress?: string
  targetBucket?: number
}

type AjnaAdapterContext = {
  strategyAddress: `0x${string}`
  ajnaPool: `0x${string}`
  authAddress: `0x${string}`
  authAdmin: `0x${string}`
  currentBucket: number
}

export type AjnaWorkflowResult = {
  chainId: number
  eligibleVaults: number
  selectedVaults: number
  enqueuedActions: number
  skippedActions: number
  errors: string[]
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
): `0x${string}` {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return decodeFunctionResult({ abi, functionName, data: bytesToHex(data) } as any) as `0x${string}`
}

function decodeNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any,
  functionName: string,
  data: Uint8Array,
): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = decodeFunctionResult({ abi, functionName, data: bytesToHex(data) } as any) as
    | bigint
    | number
  return Number(value)
}

export function parseAjnaManualPayload(payload: Uint8Array | undefined): AjnaManualPayload {
  if (!payload || payload.length === 0) return {}
  const raw = Buffer.from(payload).toString("utf-8").trim()
  try {
    return JSON.parse(raw) as AjnaManualPayload
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as AjnaManualPayload
    } catch {
      throw new Error("invalid_manual_payload")
    }
  }
}

function normalizeVaultAddress(value?: string): `0x${string}` | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null
  return trimmed.toLowerCase() as `0x${string}`
}

function normalizeOptionalInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.trunc(value)
}

function strategyDedupeKey(
  vaultAddress: `0x${string}`,
  strategyAddress: `0x${string}`,
  targetBucket: number,
): string {
  return `vault:${vaultAddress.toLowerCase()}:strategy:${strategyAddress.toLowerCase()}:action:strategy.ajna.rebucket:band:${targetBucket}`
}

function isChainReadLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("CallLimit limited")
}

function readOracleSuggestedBucket(
  runtime: Runtime<AjnaManagerConfig>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  oracleAddress: `0x${string}`,
): number | null {
  const twapTick = decodeNumber(
    OracleStrategyViewABI,
    "getV3TWAPTick",
    readContractBytes(runtime, evmClient, {
      address: oracleAddress,
      abi: OracleStrategyViewABI,
      functionName: "getV3TWAPTick",
      args: [runtime.config.twapDuration],
    }),
  )

  const creatorToken = decodeAddress(
    OracleStrategyViewABI,
    "v3CreatorToken",
    readContractBytes(runtime, evmClient, {
      address: oracleAddress,
      abi: OracleStrategyViewABI,
      functionName: "v3CreatorToken",
    }),
  )

  const usdToken = decodeAddress(
    OracleStrategyViewABI,
    "v3UsdToken",
    readContractBytes(runtime, evmClient, {
      address: oracleAddress,
      abi: OracleStrategyViewABI,
      functionName: "v3UsdToken",
    }),
  )

  const creatorDecimals = decodeNumber(
    OracleStrategyViewABI,
    "v3CreatorDecimals",
    readContractBytes(runtime, evmClient, {
      address: oracleAddress,
      abi: OracleStrategyViewABI,
      functionName: "v3CreatorDecimals",
    }),
  )

  const usdDecimals = decodeNumber(
    OracleStrategyViewABI,
    "v3UsdDecimals",
    readContractBytes(runtime, evmClient, {
      address: oracleAddress,
      abi: OracleStrategyViewABI,
      functionName: "v3UsdDecimals",
    }),
  )

  return deriveAjnaBucketFromV3Tick({
    twapTick,
    creatorToken,
    usdToken,
    creatorDecimals,
    usdDecimals,
    targetLtvBps: runtime.config.targetLtvBps,
  })
}

function readAjnaStrategiesForVault(
  runtime: Runtime<AjnaManagerConfig>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  vaultAddress: `0x${string}`,
): AjnaAdapterContext[] {
  const out: AjnaAdapterContext[] = []
  for (let i = 0; i < runtime.config.maxStrategiesPerVault; i += 1) {
    let strategyAddress: `0x${string}`
    try {
      strategyAddress = decodeAddress(
        VaultStrategyViewABI,
        "strategyList",
        readContractBytes(runtime, evmClient, {
          address: vaultAddress,
          abi: VaultStrategyViewABI,
          functionName: "strategyList",
          args: [BigInt(i)],
        }),
      )
    } catch (error) {
      if (isChainReadLimitError(error)) {
        runtime.log(`Stopping Ajna strategy scan for ${vaultAddress}: chain read call limit reached`)
        break
      }
      const message = error instanceof Error ? error.message : String(error)
      runtime.log(
        `Stopping Ajna strategy scan for ${vaultAddress} at index ${i}: unreadable strategy slot (${message})`,
      )
      break
    }

    if (strategyAddress.toLowerCase() === zeroAddress.toLowerCase()) break

    let strategyWeight: bigint
    try {
      strategyWeight = decodeBigInt(
        VaultStrategyViewABI,
        "strategyWeights",
        readContractBytes(runtime, evmClient, {
          address: vaultAddress,
          abi: VaultStrategyViewABI,
          functionName: "strategyWeights",
          args: [strategyAddress],
        }),
      )
    } catch (error) {
      if (isChainReadLimitError(error)) {
        runtime.log(`Stopping Ajna strategy scan for ${vaultAddress}: chain read call limit reached`)
        break
      }
      const message = error instanceof Error ? error.message : String(error)
      runtime.log(
        `Skipping Ajna strategy weight read for ${strategyAddress} in vault ${vaultAddress}: ${message}`,
      )
      continue
    }
    if (strategyWeight === 0n) continue

    try {
      const innerVault = decodeAddress(
        AjnaAdapterViewABI,
        "ERC4626_VAULT",
        readContractBytes(runtime, evmClient, {
          address: strategyAddress,
          abi: AjnaAdapterViewABI,
          functionName: "ERC4626_VAULT",
        }),
      )
      if (innerVault.toLowerCase() === zeroAddress.toLowerCase()) continue

      const ajnaPool = decodeAddress(
        AjnaInnerVaultViewABI,
        "AJNA_POOL",
        readContractBytes(runtime, evmClient, {
          address: innerVault,
          abi: AjnaInnerVaultViewABI,
          functionName: "AJNA_POOL",
        }),
      )
      if (ajnaPool.toLowerCase() === zeroAddress.toLowerCase()) continue

      const authAddress = decodeAddress(
        AjnaInnerVaultViewABI,
        "AUTH",
        readContractBytes(runtime, evmClient, {
          address: innerVault,
          abi: AjnaInnerVaultViewABI,
          functionName: "AUTH",
        }),
      )
      if (authAddress.toLowerCase() === zeroAddress.toLowerCase()) continue

      const authAdmin = decodeAddress(
        AjnaAuthViewABI,
        "admin",
        readContractBytes(runtime, evmClient, {
          address: authAddress,
          abi: AjnaAuthViewABI,
          functionName: "admin",
        }),
      )
      if (authAdmin.toLowerCase() === zeroAddress.toLowerCase()) continue

      const currentBucket = decodeNumber(
        AjnaAuthViewABI,
        "minBucketIndex",
        readContractBytes(runtime, evmClient, {
          address: authAddress,
          abi: AjnaAuthViewABI,
          functionName: "minBucketIndex",
        }),
      )

      out.push({
        strategyAddress,
        ajnaPool,
        authAddress,
        authAdmin,
        currentBucket,
      })
    } catch (error) {
      if (isChainReadLimitError(error)) {
        runtime.log(`Stopping Ajna strategy scan for ${vaultAddress}: chain read call limit reached`)
        break
      }
      const message = error instanceof Error ? error.message : String(error)
      runtime.log(
        `Skipping non-Ajna/unreadable strategy ${strategyAddress} for vault ${vaultAddress}: ${message}`,
      )
      continue
    }
  }
  return out
}

function pickLiquidityAwareTarget(
  runtime: Runtime<AjnaManagerConfig>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  ajnaPool: `0x${string}`,
  steppedBucket: number,
): number {
  const radius = Math.max(0, runtime.config.liquiditySearchRadius)
  const start = Math.max(1, steppedBucket - radius)
  const end = steppedBucket + radius
  const candidates: Array<{ index: number; deposit: bigint }> = []

  for (let idx = start; idx <= end; idx += 1) {
    const bucketInfoData = readContractBytes(runtime, evmClient, {
      address: ajnaPool,
      abi: AjnaPoolViewABI,
      functionName: "bucketInfo",
      args: [BigInt(idx)],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bucketInfo = decodeFunctionResult({
      abi: AjnaPoolViewABI,
      functionName: "bucketInfo",
      data: bytesToHex(bucketInfoData),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as [bigint, bigint, bigint, bigint, bigint]
    candidates.push({ index: idx, deposit: bucketInfo[3] ?? 0n })
  }

  return pickBestLiquidityBucket({
    centerBucket: steppedBucket,
    candidates,
  })
}

export function evaluateAndEnqueueAjnaActions(
  runtime: Runtime<AjnaManagerConfig>,
  manual: AjnaManualPayload = {},
): AjnaWorkflowResult {
  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  const canForceEnqueue = manual.forceEnqueue === true && manual.authToken === apiKey
  const chainId = resolveChainId(runtime.config.chainName, runtime.config.chainId)
  const evmClient = createEvmClientForChain(runtime.config.chainName)
  const httpClient = new HTTPClient()

  const allVaults = runtime.runInNodeMode(
    (nr: NodeRuntime<AjnaManagerConfig>) => fetchActiveVaults(nr, httpClient, apiKey, chainId),
    consensusIdenticalAggregation(),
  )().result()

  const manualVault = normalizeVaultAddress(manual.vaultAddress)
  const eligibleVaults = allVaults
    .filter((vault) => Boolean(vault.oracleAddress) && Boolean(vault.groupId))
    .filter((vault) => (manualVault ? vault.vaultAddress.toLowerCase() === manualVault : true))
    .sort((a, b) => a.vaultAddress.localeCompare(b.vaultAddress))

  const selectedVaults = selectRotatingItems<ActiveVaultConfig>(eligibleVaults, {
    now: runtime.now(),
    rotationIntervalSeconds: runtime.config.rotationIntervalSeconds,
    maxItems: manual.maxVaultsPerExecution ?? runtime.config.maxVaultsPerExecution,
  })

  const errors: string[] = []
  let enqueuedActions = 0
  let skippedActions = 0

  for (const vault of selectedVaults) {
    if (!vault.oracleAddress) continue

    try {
      if (manual.forceEnqueue && !canForceEnqueue) {
        skippedActions += 1
        runtime.log(
          `Skipping forced Ajna enqueue for ${vault.vaultAddress}: missing or invalid authToken in manual payload`,
        )
        continue
      }

      if (canForceEnqueue) {
        const forcedStrategyAddress = normalizeVaultAddress(manual.strategyAddress)
        if (!forcedStrategyAddress) {
          skippedActions += 1
          runtime.log(
            `Skipping forced Ajna enqueue for ${vault.vaultAddress}: invalid strategyAddress in manual payload`,
          )
          continue
        }

        const forcedTargetBucket = normalizeOptionalInteger(manual.targetBucket) ?? 1
        if (forcedTargetBucket < 0) {
          skippedActions += 1
          runtime.log(
            `Skipping forced Ajna enqueue for ${vault.vaultAddress}: targetBucket must be >= 0`,
          )
          continue
        }

        const strategies = readAjnaStrategiesForVault(runtime, evmClient, vault.vaultAddress)
        const forcedStrategy = strategies.find(
          (strategy) => strategy.strategyAddress.toLowerCase() === forcedStrategyAddress,
        )
        if (!forcedStrategy) {
          skippedActions += 1
          runtime.log(
            `Skipping forced Ajna enqueue for ${vault.vaultAddress}: strategy ${forcedStrategyAddress} not found in vault strategy list`,
          )
          continue
        }

        const actionType = "strategy.ajna.rebucket"
        const actionPayload = {
          action: actionType,
          actionType,
          forced: true,
          vaultAddress: vault.vaultAddress,
          strategyAddress: forcedStrategyAddress,
          authAddress: forcedStrategy.authAddress,
          oracleAddress: vault.oracleAddress,
          currentBucket: forcedStrategy.currentBucket,
          suggestedBucket: forcedTargetBucket,
          steppedBucket: forcedTargetBucket,
          targetBucket: forcedTargetBucket,
          method: "setMinBucketIndex",
          timestamp: runtime.now().toISOString(),
        } satisfies Record<string, unknown>

        const actionId = runtime.runInNodeMode(
          (nr: NodeRuntime<AjnaManagerConfig>) =>
            enqueueStrategyAction(nr, httpClient, apiKey, {
              vaultAddress: vault.vaultAddress,
              groupId: vault.groupId,
              actionType,
              dedupeKey: `force:${strategyDedupeKey(vault.vaultAddress, forcedStrategy.authAddress, forcedTargetBucket)}`,
              action: actionPayload,
            }),
          consensusIdenticalAggregation(),
        )().result()

        enqueuedActions += 1
        runtime.log(
          `Force-enqueued Ajna rebucket action id=${actionId} vault=${vault.vaultAddress} strategy=${forcedStrategyAddress} targetBucket=${forcedTargetBucket}`,
        )
        continue
      }

      const suggestedBucket = readOracleSuggestedBucket(runtime, evmClient, vault.oracleAddress)
      if (suggestedBucket === null) {
        skippedActions += 1
        continue
      }

      const strategies = readAjnaStrategiesForVault(runtime, evmClient, vault.vaultAddress)
      for (const strategy of strategies) {
        try {
          const deviationBps = bucketPriceChangeBps({
            currentBucket: strategy.currentBucket,
            suggestedBucket,
          })
          if (deviationBps < runtime.config.priceChangeTriggerBps) {
            skippedActions += 1
            continue
          }

          const step = computeSteppedBucket({
            currentBucket: strategy.currentBucket,
            suggestedBucket,
            moveThreshold: runtime.config.moveThreshold,
            maxStep: runtime.config.maxStep,
          })
          if (!step.shouldMove) {
            skippedActions += 1
            continue
          }

          const targetBucket = pickLiquidityAwareTarget(
            runtime,
            evmClient,
            strategy.ajnaPool,
            step.steppedBucket,
          )
          if (targetBucket === strategy.currentBucket) {
            skippedActions += 1
            continue
          }

          const method = "setMinBucketIndex"

          const actionType = "strategy.ajna.rebucket"
          const actionPayload = {
            action: actionType,
            actionType,
            vaultAddress: vault.vaultAddress,
            strategyAddress: strategy.strategyAddress,
            authAddress: strategy.authAddress,
            oracleAddress: vault.oracleAddress,
            currentBucket: strategy.currentBucket,
            suggestedBucket,
            steppedBucket: step.steppedBucket,
            targetBucket,
            method,
            computedDeviationBps: deviationBps,
            timestamp: runtime.now().toISOString(),
          } satisfies Record<string, unknown>

          const actionId = runtime.runInNodeMode(
            (nr: NodeRuntime<AjnaManagerConfig>) =>
              enqueueStrategyAction(nr, httpClient, apiKey, {
                vaultAddress: vault.vaultAddress,
                groupId: vault.groupId,
                actionType,
              dedupeKey: strategyDedupeKey(vault.vaultAddress, strategy.authAddress, targetBucket),
                action: actionPayload,
              }),
            consensusIdenticalAggregation(),
          )().result()

          enqueuedActions += 1
          runtime.log(
            `Enqueued Ajna rebucket action id=${actionId} vault=${vault.vaultAddress} strategy=${strategy.strategyAddress} targetBucket=${targetBucket}`,
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          runtime.log(
            `Skipping Ajna strategy ${strategy.strategyAddress} for vault ${vault.vaultAddress}: ${message}`,
          )
          skippedActions += 1
          continue
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${vault.vaultAddress}:${message}`)
      runtime.log(`Ajna evaluation failed for ${vault.vaultAddress}: ${message}`)
    }
  }

  return {
    chainId,
    eligibleVaults: eligibleVaults.length,
    selectedVaults: selectedVaults.length,
    enqueuedActions,
    skippedActions,
    errors,
  }
}
