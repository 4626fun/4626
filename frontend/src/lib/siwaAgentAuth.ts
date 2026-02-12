import { buildSIWAMessage } from '@buildersgarden/siwa'

import { apiFetch } from './apiBase'
import { clearStoredSiwaReceipt, setStoredSiwaReceipt } from './siwaReceiptStorage'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type AgentNonceResponse = {
  nonce: string
  issuedAt: string
  expirationTime: string
  domain: string
  uri: string
  chainId: number
  agentId: number
  agentRegistry: string
  ownerAddress: string
}

type AgentVerifyResponse = {
  address: string
  ownerAddress: string
  agentId: number
  agentRegistry: string
  chainId: number
  verified: 'offline' | 'onchain'
  receipt: string
  receiptExpiresAt: string
}

export type SignInWithSiwaAgentParams = {
  agentId: number
  signMessage: (message: string) => Promise<string>
  ownerAddress?: string
  agentRegistry?: string
  statement?: string
}

export type SignInWithSiwaAgentResult = AgentVerifyResponse

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value instanceof Error && value.message.trim()) return value.message.trim()
  const maybe = value as any
  if (typeof maybe?.error === 'string' && maybe.error.trim()) return maybe.error.trim()
  if (typeof maybe?.message === 'string' && maybe.message.trim()) return maybe.message.trim()
  return fallback
}

async function readApiEnvelope<T>(res: Response): Promise<ApiEnvelope<T> | null> {
  try {
    return (await res.json()) as ApiEnvelope<T>
  } catch {
    return null
  }
}

export async function signInWithSiwaAgent(params: SignInWithSiwaAgentParams): Promise<SignInWithSiwaAgentResult> {
  const agentId = Number(params.agentId)
  if (!Number.isFinite(agentId) || Math.floor(agentId) !== agentId || agentId < 0) {
    throw new Error('agentId must be a non-negative integer')
  }
  if (typeof params.signMessage !== 'function') {
    throw new Error('signMessage callback is required')
  }

  const ownerAddress = typeof params.ownerAddress === 'string' ? params.ownerAddress.trim() : ''
  const agentRegistry = typeof params.agentRegistry === 'string' ? params.agentRegistry.trim() : ''

  const nonceRes = await apiFetch('/api/auth/agent-nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      agentId,
      ...(ownerAddress ? { ownerAddress } : null),
      ...(agentRegistry ? { agentRegistry } : null),
    }),
    withCredentials: true,
  })
  const nonceJson = await readApiEnvelope<AgentNonceResponse>(nonceRes)
  if (!nonceRes.ok || !nonceJson?.success || !nonceJson.data) {
    throw new Error(toErrorMessage(nonceJson?.error, 'Failed to issue SIWA nonce'))
  }

  const nonceData = nonceJson.data
  const message = buildSIWAMessage({
    domain: nonceData.domain,
    address: nonceData.ownerAddress,
    statement: params.statement ?? 'Sign in with your agent identity to access CreatorVault agent APIs.',
    uri: nonceData.uri,
    version: '1',
    agentId: nonceData.agentId,
    agentRegistry: nonceData.agentRegistry,
    chainId: nonceData.chainId,
    nonce: nonceData.nonce,
    issuedAt: nonceData.issuedAt,
    expirationTime: nonceData.expirationTime,
  })

  let signature = ''
  try {
    signature = await params.signMessage(message)
  } catch (error) {
    throw new Error(toErrorMessage(error, 'SIWA signing was cancelled'))
  }
  if (!signature || typeof signature !== 'string') {
    throw new Error('SIWA signing failed')
  }

  const verifyRes = await apiFetch('/api/auth/agent-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ message, signature }),
    withCredentials: true,
  })
  const verifyJson = await readApiEnvelope<AgentVerifyResponse>(verifyRes)
  if (!verifyRes.ok || !verifyJson?.success || !verifyJson.data) {
    clearStoredSiwaReceipt()
    throw new Error(toErrorMessage(verifyJson?.error, 'SIWA verification failed'))
  }

  const verifyData = verifyJson.data
  if (!verifyData.receipt || !verifyData.receiptExpiresAt) {
    clearStoredSiwaReceipt()
    throw new Error('SIWA verification succeeded but no receipt was returned')
  }

  setStoredSiwaReceipt({ receipt: verifyData.receipt, expiresAt: verifyData.receiptExpiresAt })
  return verifyData
}

