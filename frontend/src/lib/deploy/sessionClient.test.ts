import { describe, expect, it, vi } from 'vitest'

import {
  postDeploySessionRequestWithAuthRetry,
  resumeAndPollDeploySession,
  shouldRetryDeploySessionAuth,
  type ApiEnvelope,
  type DeploySessionStatusData,
} from './sessionClient'

function makeResponse(ok: boolean, status = ok ? 200 : 500): Response {
  return { ok, status } as Response
}

describe('sessionClient', () => {
  it('retries deploy auth errors once after re-bridging auth', async () => {
    const ensurePaymasterSession = vi.fn(async () => {})
    const postJson = vi
      .fn()
      .mockResolvedValueOnce({
        response: makeResponse(false, 401),
        json: { success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>,
      })
      .mockResolvedValueOnce({
        response: makeResponse(true, 200),
        json: { success: true, data: { ok: true } } satisfies ApiEnvelope<{ ok: boolean }>,
      })

    const result = await postDeploySessionRequestWithAuthRetry<{ ok: boolean }>({
      postJson,
      url: '/api/deploy/session/status',
      body: { sessionId: 'sess_1' },
      label: 'deploy session status',
      ensurePaymasterSession,
    })

    expect(result.data?.ok).toBe(true)
    expect(ensurePaymasterSession).toHaveBeenCalledTimes(1)
    expect(postJson).toHaveBeenCalledTimes(2)
  })

  it('detects retryable deploy auth failures', () => {
    expect(shouldRetryDeploySessionAuth('Not authenticated')).toBe(true)
    expect(shouldRetryDeploySessionAuth('deploy ownership mismatch: stale')).toBe(true)
    expect(shouldRetryDeploySessionAuth('no_session')).toBe(true)
    expect(shouldRetryDeploySessionAuth('validation failed')).toBe(false)
  })

  it('resumes a created session, reauths status fetches, and polls to completion', async () => {
    const ensurePaymasterSession = vi.fn(async () => {})
    const ensureDeploySessionSignerInstalled = vi.fn(async () => {})
    const clearDeploySession = vi.fn()
    const onStatus = vi.fn()
    const onCompleted = vi.fn()
    const statuses: DeploySessionStatusData[] = [
      { step: 'created', sessionSignerAddress: '0x00000000000000000000000000000000000000aa' },
      { step: 'phase2_sent', lastUserOpHash: `0x${'1'.repeat(64)}` },
      { step: 'completed', lastTxHash: `0x${'2'.repeat(64)}` },
    ]
    let statusIndex = 0
    const postJson = vi.fn(async ({ url }: { url: string }) => {
      if (url === '/api/deploy/session/status') {
        if (statusIndex === 0 && ensurePaymasterSession.mock.calls.length === 0) {
          return {
            response: makeResponse(false, 401),
            json: { success: false, error: 'Not authenticated' } satisfies ApiEnvelope<null>,
          }
        }
        const next = statuses[statusIndex]
        statusIndex += 1
        if (!next) throw new Error('missing_status')
        return {
          response: makeResponse(true, 200),
          json: { success: true, data: next } satisfies ApiEnvelope<DeploySessionStatusData>,
        }
      }
      if (url === '/api/deploy/session/continue') {
        return {
          response: makeResponse(true, 200),
          json: { success: true, data: { ok: true } } satisfies ApiEnvelope<{ ok: boolean }>,
        }
      }
      throw new Error(`unexpected_url:${url}`)
    })

    const completed = await resumeAndPollDeploySession({
      sessionId: 'sess_1',
      postJson,
      ensurePaymasterSession,
      ensureDeploySessionSignerInstalled,
      clearDeploySession,
      onStatus,
      onCompleted,
      initialDelayMs: 1,
      maxDelayMs: 2,
      maxDurationMs: 1_000,
      sleep: async () => {},
      now: (() => {
        let value = 0
        return () => {
          value += 10
          return value
        }
      })(),
    })

    expect(ensurePaymasterSession).toHaveBeenCalledTimes(1)
    expect(ensureDeploySessionSignerInstalled).toHaveBeenCalledWith(
      '0x00000000000000000000000000000000000000AA',
    )
    expect(onStatus).toHaveBeenCalledTimes(3)
    expect(onCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'completed', lastTxHash: `0x${'2'.repeat(64)}` }),
    )
    expect(clearDeploySession).toHaveBeenCalledTimes(1)
    expect(completed.step).toBe('completed')
  })
})
