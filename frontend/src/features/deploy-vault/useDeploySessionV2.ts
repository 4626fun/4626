import { useCallback } from 'react'
import type { Address } from 'viem'

import {
  postDeploySessionRequestWithAuthRetry,
  resumeAndPollDeploySession,
  type ApiEnvelope,
  type DeploySessionStatusData,
  type PostJsonWithTimeout,
} from '@/lib/deploy/sessionClient'

export function useDeploySessionV2() {
  const postSessionRequest = useCallback(
    async <T>(params: {
      postJson: PostJsonWithTimeout
      ensurePaymasterSession: () => Promise<void>
      url: string
      body: unknown
      label: string
      maxAuthRetries?: number
    }): Promise<ApiEnvelope<T>> =>
      postDeploySessionRequestWithAuthRetry<T>({
        postJson: params.postJson,
        ensurePaymasterSession: params.ensurePaymasterSession,
        url: params.url,
        body: params.body,
        label: params.label,
        maxAuthRetries: params.maxAuthRetries,
      }),
    [],
  )

  const pollSession = useCallback(
    async (params: {
      sessionId: string
      postJson: PostJsonWithTimeout
      ensurePaymasterSession: () => Promise<void>
      ensureDeploySessionSignerInstalled: (sessionSigner: Address) => Promise<void>
      clearDeploySession: () => void
      onStatus?: (data: DeploySessionStatusData) => void
      onCompleted?: (data: DeploySessionStatusData) => void
    }) =>
      resumeAndPollDeploySession({
        sessionId: params.sessionId,
        postJson: params.postJson,
        ensurePaymasterSession: params.ensurePaymasterSession,
        ensureDeploySessionSignerInstalled: params.ensureDeploySessionSignerInstalled,
        clearDeploySession: params.clearDeploySession,
        onStatus: params.onStatus,
        onCompleted: params.onCompleted,
      }),
    [],
  )

  return { postSessionRequest, pollSession }
}
