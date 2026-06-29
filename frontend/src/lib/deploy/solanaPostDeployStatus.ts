import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

export type SolanaPostDeployOverall = 'disabled' | 'waiting' | 'in_progress' | 'complete' | 'failed'

export type SolanaPostDeployStatus = {
  enabled: boolean
  deployComplete: boolean
  overall: SolanaPostDeployOverall
  shareMeshMapping: {
    shareOft: string
    shareMeshMint: string
    status: string
    lastError: string | null
  } | null
  meteoraPool: {
    status: 'pending' | 'creating' | 'created' | 'failed' | 'skipped' | 'not_started'
    poolAddress: string | null
    lastError: string | null
    lastSignature: string | null
  } | null
  nextStep: string | null
}

export async function fetchSolanaPostDeployStatus(sessionId: string): Promise<SolanaPostDeployStatus> {
  const response = await apiFetch('/api/deploy/v2/session/solana-post-deploy-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  const res = (await response.json().catch(() => null)) as ApiEnvelope<SolanaPostDeployStatus> | null
  if (!response.ok || !res?.success || !res.data) {
    throw new Error(res?.error ?? 'solana_post_deploy_status_failed')
  }
  return res.data
}

export function solanaPostDeployProgressLabel(overall: SolanaPostDeployOverall): string {
  switch (overall) {
    case 'complete':
      return 'complete'
    case 'failed':
      return 'needs attention'
    case 'waiting':
      return 'waiting for deploy'
    case 'disabled':
      return 'not enabled'
    default:
      return 'in progress'
  }
}
