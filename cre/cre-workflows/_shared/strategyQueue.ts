import { HTTPClient, type NodeRuntime } from "@chainlink/cre-sdk"
import { getJson, postJson, type ApiRuntimeConfig } from "./http"

export type StrategyWorkflowConfig = ApiRuntimeConfig & {
  chainId?: number
}

export type ActiveVaultConfig = {
  vaultAddress: `0x${string}`
  chainId: number
  groupId: string
  oracleAddress?: `0x${string}`
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
    `/cre/vaults/active?chainId=${chainId}`,
  )
  return body.success && body.data ? body.data.vaults : []
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
