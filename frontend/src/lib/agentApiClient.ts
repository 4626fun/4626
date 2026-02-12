import { apiFetch, type ApiFetchInit } from './apiBase'
import { signInWithSiwaAgent } from './siwaAgentAuth'
import { clearStoredSiwaReceipt, getStoredSiwaReceipt } from './siwaReceiptStorage'

export type AgentApiClientConfig = {
  agentId: number
  signMessage: (message: string) => Promise<string>
  ownerAddress?: string
  agentRegistry?: string
  statement?: string
}

function isProtectedAgentPath(path: string): boolean {
  return path.startsWith('/api/v1/agents/')
}

export function createAgentApiClient(config: AgentApiClientConfig) {
  async function ensureAuthenticated(): Promise<void> {
    if (getStoredSiwaReceipt()) return
    await signInWithSiwaAgent({
      agentId: config.agentId,
      signMessage: config.signMessage,
      ownerAddress: config.ownerAddress,
      agentRegistry: config.agentRegistry,
      statement: config.statement,
    })
  }

  async function fetch(path: string, init: ApiFetchInit = {}, bases?: string[]): Promise<Response> {
    if (isProtectedAgentPath(path)) {
      await ensureAuthenticated()
    }
    return apiFetch(path, init, bases)
  }

  return {
    fetch,
    ensureAuthenticated,
    clearAuthentication: clearStoredSiwaReceipt,
  }
}

