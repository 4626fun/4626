import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import type { ApiEnvelope } from '@/lib/wallet/onboardingBootstrapTypes'
import type { PreparedOwnerTxRequest } from '@/lib/wallet/zoraAddOwnerApi'

export type ActivationStatusResponse = {
  parentCswAddress: `0x${string}`
  embeddedEoaAddress: `0x${string}`
  serverWalletAddress: `0x${string}` | null
  embeddedOwnerConfirmed: boolean
  serverOwnerConfirmed: boolean
  xmtpProvisioned: boolean
}

export type ProvisionAutomationOwnerResponse = {
  alreadyOwner: boolean
  agentWalletAddress: `0x${string}`
  embeddedOwnerConfirmed: true
  activationToken: string
  txRequest?: PreparedOwnerTxRequest
}

async function readEnvelope<T>(response: Response, label: string): Promise<T> {
  const envelope = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok || !envelope?.success || !envelope.data) {
    throw new Error(envelope?.error ?? `${label} failed (${response.status})`)
  }
  return envelope.data
}

export async function fetchActivationStatus(params: {
  headers: Record<string, string>
}): Promise<ActivationStatusResponse> {
  const response = await apiFetch(API_ENDPOINTS.onboarding.activationStatus, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      ...params.headers,
    },
  })
  return readEnvelope(response, 'activation-status')
}

export async function provisionAutomationOwner(params: {
  headers: Record<string, string>
}): Promise<ProvisionAutomationOwnerResponse> {
  const response = await apiFetch(API_ENDPOINTS.onboarding.provisionAgentOwner, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...params.headers,
    },
    body: JSON.stringify({ purpose: 'enable_4626_server_owner' }),
  })
  return readEnvelope(response, 'provision-agent-owner')
}

export async function completeActivation(params: {
  headers: Record<string, string>
  activationToken: string
}): Promise<{ ready: true; parentCswAddress: string; serverWalletAddress: string; xmtpIdentifier: string }> {
  const response = await apiFetch(API_ENDPOINTS.onboarding.completeActivation, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...params.headers,
    },
    body: JSON.stringify({ activationToken: params.activationToken }),
  })
  return readEnvelope(response, 'complete-activation')
}
