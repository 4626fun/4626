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
import { constantTimeEqualString } from "./manualTriggerAuth"

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
  forceEnqueue?: boolean
  // H-01 (audit 2026-04-25): `authToken` is the HMAC-SHA256 signature of the
  // canonical payload (see `manualTriggerAuth.ts`). It authorizes that the
  // caller knows the webhook secret — it does NOT authorize force-enqueue.
  authToken?: string
  // H-01 (audit 2026-04-25): callers must include `timestamp` (epoch ms) and
  // `nonce` (>=16 hex chars) so the webhook signature can be rebuilt as
  // hmac-sha256(secret, `${timestamp}.${nonce}.${stableJson(rest)}`).
  timestamp?: number | string
  nonce?: string
  // 4626-audit-2026-04-25: separate field for the FORCE_ENQUEUE_AUTH_TOKEN
  // shared secret. Required (in addition to a valid HMAC envelope) when
  // `forceEnqueue=true`. Compared in constant time against the secret.
  forceEnqueueAuthToken?: string
  strategyAddress?: string
  charmVaultAddress?: string
  referenceTick?: number
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
    // FIX: MED-02 — Log a warning when base64 fallback parsing is used (potential injection vector)
    try {
      console.warn('[CRE][charm] Manual payload was not valid JSON; attempting base64 decode fallback')
      const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf-8")) as CharmManualPayload
      // FIX: MED-02 — Validate vaultAddress/strategyAddress against format in forceEnqueue payloads
      if (decoded.forceEnqueue && decoded.vaultAddress && !normalizeVaultAddress(decoded.vaultAddress)) {
        throw new Error("invalid_vault_address_in_base64_payload")
      }
      return decoded
    } catch (innerErr) {
      if (innerErr instanceof Error && innerErr.message.includes('invalid_vault_address')) throw innerErr
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
      const message = error instanceof Error ? error.message : String(error)
      runtime.log(
        `Stopping Charm strategy scan for ${vaultAddress} at index ${i}: unreadable strategy slot (${message})`,
      )
      break
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
      const message = error instanceof Error ? error.message : String(error)
      runtime.log(
        `Skipping Charm strategy weight read for ${strategyAddress} in vault ${vaultAddress}: ${message}`,
      )
      continue
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
  const apiKey = runtime.getSecret({ id: "KPR_API_KEY" }).result().value
  // FIX: CRT-03 — Use separate FORCE_ENQUEUE_AUTH_TOKEN secret for manual override auth.
  // 4626-audit-2026-04-25 review: after the H-01 HMAC migration, `authToken` is the
  // HMAC signature, NOT the force-enqueue secret. Force-enqueue authorization is now
  // gated on a dedicated `forceEnqueueAuthToken` field, constant-time compared against
  // the configured secret. Both checks must pass: valid HMAC envelope (already
  // verified by the workflow `onHttpTrigger`) AND a matching force-enqueue token.
  const forceEnqueueToken = runtime.getSecret({ id: "FORCE_ENQUEUE_AUTH_TOKEN" }).result().value || apiKey
  const providedForceToken =
    typeof manual.forceEnqueueAuthToken === "string" ? manual.forceEnqueueAuthToken : ""
  const canForceEnqueue =
    manual.forceEnqueue === true &&
    forceEnqueueToken.length > 0 &&
    constantTimeEqualString(providedForceToken, forceEnqueueToken)
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
      if (manual.forceEnqueue && !canForceEnqueue) {
        skippedActions += 1
        runtime.log(
          `Skipping forced Charm enqueue for ${vault.vaultAddress}: missing or invalid authToken in manual payload`,
        )
        continue
      }

      if (canForceEnqueue) {
        const forcedStrategyAddress = normalizeVaultAddress(manual.strategyAddress)
        if (!forcedStrategyAddress) {
          skippedActions += 1
          runtime.log(
            `Skipping forced Charm enqueue for ${vault.vaultAddress}: invalid strategyAddress in manual payload`,
          )
          continue
        }
        // FIX: MED-05 — Reject invalid charmVaultAddress instead of silently falling back to zeroAddress
        const forcedCharmVaultAddress = manual.charmVaultAddress !== undefined
          ? normalizeVaultAddress(manual.charmVaultAddress)
          : null
        if (manual.charmVaultAddress !== undefined && forcedCharmVaultAddress === null) {
          skippedActions += 1
          runtime.log(
            `Skipping forced Charm enqueue for ${vault.vaultAddress}: invalid charmVaultAddress in manual payload`,
          )
          continue
        }
        const forcedReferenceTick = normalizeOptionalInteger(manual.referenceTick) ?? 0

        const strategies = readCharmStrategiesForVault(runtime, evmClient, vault.vaultAddress)
        const forcedStrategy = strategies.find(
          (strategy) => strategy.strategyAddress.toLowerCase() === forcedStrategyAddress,
        )
        if (!forcedStrategy) {
          skippedActions += 1
          runtime.log(
            `Skipping forced Charm enqueue for ${vault.vaultAddress}: strategy ${forcedStrategyAddress} not found in vault strategy list`,
          )
          continue
        }

        if (
          forcedCharmVaultAddress !== null &&
          forcedStrategy.charmVaultAddress.toLowerCase() !== forcedCharmVaultAddress
        ) {
          skippedActions += 1
          runtime.log(
            `Skipping forced Charm enqueue for ${vault.vaultAddress}: charmVaultAddress ${forcedCharmVaultAddress} does not match strategy vault`,
          )
          continue
        }

        const actionType = "strategy.charm.rebalance"
        const actionPayload = {
          action: actionType,
          actionType,
          forced: true,
          vaultAddress: vault.vaultAddress,
          strategyAddress: forcedStrategyAddress,
          charmVaultAddress: forcedStrategy.charmVaultAddress,
          oracleAddress: vault.oracleAddress,
          triggerTick: forcedReferenceTick,
          referenceTick: forcedReferenceTick,
          computedDeviationBps: 0,
          timestamp: runtime.now().toISOString(),
        } satisfies Record<string, unknown>

        const actionId = runtime.runInNodeMode(
          (nr: NodeRuntime<CharmManagerConfig>) =>
            enqueueStrategyAction(nr, httpClient, apiKey, {
              vaultAddress: vault.vaultAddress,
              groupId: vault.groupId,
              actionType,
              dedupeKey: `force:${charmDedupeKey(vault.vaultAddress, forcedStrategyAddress, forcedReferenceTick)}`,
              action: actionPayload,
            }),
          consensusIdenticalAggregation(),
        )().result()

        enqueuedActions += 1
        runtime.log(
          `Force-enqueued Charm rebalance action id=${actionId} vault=${vault.vaultAddress} strategy=${forcedStrategyAddress}`,
        )
        continue
      }

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
