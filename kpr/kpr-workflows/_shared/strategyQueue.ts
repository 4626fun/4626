import { HTTPClient, type NodeRuntime } from "./kprWorkflowRuntime"
import { getJson, postJson, type ApiRuntimeConfig } from "./http"

export type StrategyWorkflowConfig = ApiRuntimeConfig & {
  chainId?: number
}

export type ActiveVaultAutomationConfig = {
  automationEnabled: boolean
  automationScope?: string
  canonicalCswAddress?: `0x${string}`
  embeddedEoaAddress?: `0x${string}`
  privyWalletId?: string
}

export type ActiveVaultConfig = {
  vaultAddress: `0x${string}`
  chainId: number
  groupId: string
  oracleAddress?: `0x${string}`
  automation?: ActiveVaultAutomationConfig
}

type ActiveVaultResponse = {
  success: boolean
  data?: {
    vaults: ActiveVaultConfig[]
  }
}

type EnqueueResponse = {
  success: boolean
  data?: {
    id: number
  }
}

type VaultRecord = {
  vaultAddress?: unknown
  chainId?: unknown
  groupId?: unknown
  oracleAddress?: unknown
  automation?: unknown
}

type VaultAutomationRecord = {
  automationEnabled?: unknown
  automationScope?: unknown
  canonicalCswAddress?: unknown
  embeddedEoaAddress?: unknown
  privyWalletId?: unknown
}

function toOptionalHexAddress(value: unknown): `0x${string}` | undefined {
  if (typeof value !== "string" || !value.startsWith("0x") || value.length !== 42) {
    return undefined
  }
  return value as `0x${string}`
}

function sanitizeActiveVaultAutomation(value: unknown): ActiveVaultAutomationConfig | undefined {
  if (!value || typeof value !== "object") return undefined

  const record = value as VaultAutomationRecord
  const automationScope =
    typeof record.automationScope === "string" && record.automationScope.trim().length > 0
      ? record.automationScope.trim()
      : undefined
  const canonicalCswAddress = toOptionalHexAddress(record.canonicalCswAddress)
  const embeddedEoaAddress = toOptionalHexAddress(record.embeddedEoaAddress)
  const privyWalletId =
    typeof record.privyWalletId === "string" && record.privyWalletId.trim().length > 0
      ? record.privyWalletId.trim()
      : undefined
  const hasAutomationFields =
    typeof record.automationEnabled === "boolean" ||
    Boolean(automationScope) ||
    Boolean(canonicalCswAddress) ||
    Boolean(embeddedEoaAddress) ||
    Boolean(privyWalletId)

  if (!hasAutomationFields) return undefined

  return {
    automationEnabled: record.automationEnabled === true,
    ...(automationScope ? { automationScope } : {}),
    ...(canonicalCswAddress ? { canonicalCswAddress } : {}),
    ...(embeddedEoaAddress ? { embeddedEoaAddress } : {}),
    ...(privyWalletId ? { privyWalletId } : {}),
  }
}

function sanitizeActiveVaults(vaults: unknown): ActiveVaultConfig[] {
  if (!Array.isArray(vaults)) return []

  const sanitized: ActiveVaultConfig[] = []
  for (const item of vaults) {
    const record = item as VaultRecord
    const vaultAddress = toOptionalHexAddress(record.vaultAddress)
    const chainId = typeof record.chainId === "number" ? record.chainId : Number(record.chainId)
    const groupId = typeof record.groupId === "string" ? record.groupId : ""
    const oracleAddress = toOptionalHexAddress(record.oracleAddress)
    const automation = sanitizeActiveVaultAutomation(record.automation)

    if (!vaultAddress || !Number.isFinite(chainId) || !groupId) continue

    const normalized: ActiveVaultConfig = {
      vaultAddress,
      chainId,
      groupId,
    }

    if (oracleAddress) {
      normalized.oracleAddress = oracleAddress
    }

    if (automation) {
      normalized.automation = automation
    }

    sanitized.push(normalized)
  }

  return sanitized
}

export function fetchActiveVaults<Config extends StrategyWorkflowConfig>(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  chainId: number,
): ActiveVaultConfig[] {
  const body = getJson<Config, ActiveVaultResponse>(
    nodeRuntime,
    httpClient,
    apiKey,
    `/vaults/active?chainId=${chainId}`,
  )
  return body.success && body.data ? sanitizeActiveVaults(body.data.vaults) : []
}

export function enqueueStrategyAction<Config extends StrategyWorkflowConfig>(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  apiKey: string,
  payload: {
    vaultAddress: `0x${string}`
    groupId: string
    actionType: string
    dedupeKey: string
    action: Record<string, unknown>
  },
): number {
  const body = postJson<Config, EnqueueResponse>(
    nodeRuntime,
    httpClient,
    apiKey,
    "/keepr/actions/enqueue",
    payload,
  )

  if (!body.success || !body.data?.id) {
    throw new Error(`strategy_action_enqueue_failed:${payload.actionType}`)
  }
  return body.data.id
}
