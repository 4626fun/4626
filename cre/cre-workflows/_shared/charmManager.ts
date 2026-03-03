import { HTTPClient, type Runtime, type NodeRuntime, bytesToHex, consensusIdenticalAggregation } from "@chainlink/cre-sdk"
import { decodeFunctionResult, zeroAddress } from "viem"
import {
  CharmStrategyViewABI,
  CharmVaultViewABI,
  OracleStrategyViewABI,
  VaultStrategyViewABI,
} from "../contracts/abi"
import { normalizeTickToCreatorPerUsdcTick, tickPriceChangeBps } from "./strategyMath"
import {
  type ActiveVaultConfig,
  enqueueStrategyAction,
  fetchActiveVaults,
} from "./strategyQueue"
import { createEvmClientForChain, readContractBytes, resolveChainId } from "./evm"
import { selectRotatingItems } from "./rotation"

export type CharmManagerConfig = {
  apiBaseUrl: string
  chainName: string
  chainId?: number
  twapDuration: number
  priceChangeTriggerBps: number
  maxVaultsPerExecution: number
  maxStrategiesPerVault: number
  rotationIntervalSeconds: number
}

export type CharmManualPayload = {
  vaultAddress?: string
  maxVaultsPerExecution?: number
}

type CharmStrategyContext = {
  strategyAddress: `0x${string}`
  charmVaultAddress: `0x${string}`
}

type OraclePriceContext = {
  normalizedTick: number
  creatorToken: `0x${string}`
  usdToken: `0x${string}`
  creatorDecimals: number
  usdDecimals: number
}

export type CharmWorkflowResult = {
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

export function parseCharmManualPayload(payload: Uint8Array | undefined): CharmManualPayload {
  if (!payload || payload.length === 0) return {}
  const raw = Buffer.from(payload).toString("utf-8").trim()
  try {
    return JSON.parse(raw) as CharmManualPayload
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as CharmManualPayload
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

function charmDedupeKey(
  vaultAddress: `0x${string}`,
  strategyAddress: `0x${string}`,
  centerTick: number,
): string {
  const tickBand = Math.floor(centerTick / 100)
  return `vault:${vaultAddress.toLowerCase()}:strategy:${strategyAddress.toLowerCase()}:action:strategy.charm.rebalance:band:${tickBand}`
}

function isChainReadLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("CallLimit limited")
}

function readOraclePriceContext(
  runtime: Runtime<CharmManagerConfig>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  oracleAddress: `0x${string}`,
): OraclePriceContext | null {
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

  const normalizedTick = normalizeTickToCreatorPerUsdcTick({
    rawTick: twapTick,
    creatorToken,
    usdToken,
    creatorDecimals,
    usdDecimals,
  })
  if (normalizedTick === null) return null

  return {
    normalizedTick,
    creatorToken,
    usdToken,
    creatorDecimals,
    usdDecimals,
  }
}

function readCharmStrategiesForVault(
  runtime: Runtime<CharmManagerConfig>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  vaultAddress: `0x${string}`,
): CharmStrategyContext[] {
  const out: CharmStrategyContext[] = []
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
        runtime.log(`Stopping Charm strategy scan for ${vaultAddress}: chain read call limit reached`)
        break
      }
      throw error
    }
    if (strategyAddress.toLowerCase() === zeroAddress.toLowerCase()) break

    let weight: bigint
    try {
      weight = decodeBigInt(
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
        runtime.log(`Stopping Charm strategy scan for ${vaultAddress}: chain read call limit reached`)
        break
      }
      throw error
    }
    if (weight === 0n) continue

    try {
      const charmVaultAddress = decodeAddress(
        CharmStrategyViewABI,
        "charmVault",
        readContractBytes(runtime, evmClient, {
          address: strategyAddress,
          abi: CharmStrategyViewABI,
          functionName: "charmVault",
        }),
      )
      if (charmVaultAddress.toLowerCase() === zeroAddress.toLowerCase()) continue

      out.push({ strategyAddress, charmVaultAddress })
    } catch (error) {
      if (isChainReadLimitError(error)) {
        runtime.log(`Stopping Charm strategy scan for ${vaultAddress}: chain read call limit reached`)
        break
      }
      const message = error instanceof Error ? error.message : String(error)
      runtime.log(
        `Skipping non-Charm/unreadable strategy ${strategyAddress} for vault ${vaultAddress}: ${message}`,
      )
      continue
    }
  }
  return out
}

function readCharmCenterTick(
  runtime: Runtime<CharmManagerConfig>,
  evmClient: ReturnType<typeof createEvmClientForChain>,
  strategy: CharmStrategyContext,
  oracleContext: OraclePriceContext,
): number | null {
  const baseLower = decodeNumber(
    CharmVaultViewABI,
    "baseLower",
    readContractBytes(runtime, evmClient, {
      address: strategy.charmVaultAddress,
      abi: CharmVaultViewABI,
      functionName: "baseLower",
    }),
  )
  const baseUpper = decodeNumber(
    CharmVaultViewABI,
    "baseUpper",
    readContractBytes(runtime, evmClient, {
      address: strategy.charmVaultAddress,
      abi: CharmVaultViewABI,
      functionName: "baseUpper",
    }),
  )

  const centerRawTick = Math.floor((baseLower + baseUpper) / 2)
  return normalizeTickToCreatorPerUsdcTick({
    rawTick: centerRawTick,
    creatorToken: oracleContext.creatorToken,
    usdToken: oracleContext.usdToken,
    creatorDecimals: oracleContext.creatorDecimals,
    usdDecimals: oracleContext.usdDecimals,
  })
}

export function evaluateAndEnqueueCharmActions(
  runtime: Runtime<CharmManagerConfig>,
  manual: CharmManualPayload = {},
): CharmWorkflowResult {
  const apiKey = runtime.getSecret({ id: "KEEPR_API_KEY" }).result().value
  const chainId = resolveChainId(runtime.config.chainName, runtime.config.chainId)
  const evmClient = createEvmClientForChain(runtime.config.chainName)
  const httpClient = new HTTPClient()

  const allVaults = runtime.runInNodeMode(
    (nr: NodeRuntime<CharmManagerConfig>) => fetchActiveVaults(nr, httpClient, apiKey, chainId),
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
      const oracleContext = readOraclePriceContext(runtime, evmClient, vault.oracleAddress)
      if (!oracleContext) {
        skippedActions += 1
        continue
      }

      const strategies = readCharmStrategiesForVault(runtime, evmClient, vault.vaultAddress)
      for (const strategy of strategies) {
        try {
          const centerTick = readCharmCenterTick(runtime, evmClient, strategy, oracleContext)
          if (centerTick === null) {
            skippedActions += 1
            continue
          }

          const deviationBps = tickPriceChangeBps({
            currentTick: oracleContext.normalizedTick,
            referenceTick: centerTick,
          })
          if (deviationBps < runtime.config.priceChangeTriggerBps) {
            skippedActions += 1
            continue
          }

          const actionType = "strategy.charm.rebalance"
          const actionPayload = {
            action: actionType,
            actionType,
            vaultAddress: vault.vaultAddress,
            strategyAddress: strategy.strategyAddress,
            charmVaultAddress: strategy.charmVaultAddress,
            oracleAddress: vault.oracleAddress,
            triggerTick: oracleContext.normalizedTick,
            referenceTick: centerTick,
            computedDeviationBps: deviationBps,
            timestamp: runtime.now().toISOString(),
          } satisfies Record<string, unknown>

          const actionId = runtime.runInNodeMode(
            (nr: NodeRuntime<CharmManagerConfig>) =>
              enqueueStrategyAction(nr, httpClient, apiKey, {
                vaultAddress: vault.vaultAddress,
                groupId: vault.groupId,
                actionType,
                dedupeKey: charmDedupeKey(vault.vaultAddress, strategy.strategyAddress, centerTick),
                action: actionPayload,
              }),
            consensusIdenticalAggregation(),
          )().result()

          enqueuedActions += 1
          runtime.log(
            `Enqueued Charm rebalance action id=${actionId} vault=${vault.vaultAddress} strategy=${strategy.strategyAddress}`,
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          runtime.log(
            `Skipping Charm strategy ${strategy.strategyAddress} for vault ${vault.vaultAddress}: ${message}`,
          )
          skippedActions += 1
          continue
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${vault.vaultAddress}:${message}`)
      runtime.log(`Charm evaluation failed for ${vault.vaultAddress}: ${message}`)
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
