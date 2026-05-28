import { useCallback, useRef, useState } from 'react'

import type { XmtpStatus } from '@/lib/xmtp/provider'

import type { PrepareWaitlistMessagingWalletResult } from './prepareWaitlistMessagingWallet'
import type { WaitlistChatStatus } from './waitlistChatCopy'
import { shouldRetryWaitlistJoin } from './waitlistChatCopy'
import { resyncWaitlistGroupMembership } from './waitlistXmtpResync'

export type WaitlistGroupChatPipelineStep =
  | 'idle'
  | 'preparing_wallet'
  | 'connecting_messaging'
  | 'joining_group'
  | 'syncing_group'
  | 'failed'

type RunPipelineParams = {
  xmtpStatus: XmtpStatus
  privyAuthenticated: boolean
  joinStatus: WaitlistChatStatus
  hasGroupConversation: boolean
  prepare: () => Promise<PrepareWaitlistMessagingWalletResult>
  connect: (intent: 'user') => Promise<void>
  disconnect: () => void
  retryJoin: () => void
  syncWaitlistGroups: (options?: { resyncMembership?: boolean; force?: boolean }) => Promise<unknown>
  waitForJoinExecuted: () => Promise<boolean>
}

export function useWaitlistGroupChatPipeline() {
  const [step, setStep] = useState<WaitlistGroupChatPipelineStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  const runPipeline = useCallback(async (params: RunPipelineParams) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setError(null)

    try {
      if (!params.privyAuthenticated) {
        setStep('failed')
        setError(
          'Your 4626 session is active, but Privy sign-in is not loaded in this browser. Sign in with email again, then retry.',
        )
        return
      }

      if (params.hasGroupConversation) {
        setStep('idle')
        return
      }

      setStep('preparing_wallet')
      const prepared = await params.prepare()
      if (!prepared.ok) {
        setStep('failed')
        setError(prepared.error)
        return
      }

      if (params.xmtpStatus !== 'connected') {
        setStep('connecting_messaging')
        if (params.xmtpStatus === 'error') {
          params.disconnect()
        }
        await params.connect('user')
      }

      setStep('joining_group')
      if (shouldRetryWaitlistJoin(params.joinStatus)) {
        params.retryJoin()
        const joined = await params.waitForJoinExecuted()
        if (!joined) {
          setStep('failed')
          setError('Could not add you to the waitlist group yet. Try again in a moment.')
          return
        }
      } else if (
        params.joinStatus === 'pending' ||
        params.joinStatus === 'executing' ||
        params.joinStatus === 'joining'
      ) {
        const joined = await params.waitForJoinExecuted()
        if (!joined) {
          setStep('failed')
          setError('Group join is still processing. Try again shortly.')
          return
        }
      }

      setStep('syncing_group')
      const resync = await resyncWaitlistGroupMembership()
      if (!resync.ok) {
        setStep('failed')
        setError(resync.error ?? 'Could not refresh waitlist group membership.')
        return
      }

      await params.syncWaitlistGroups({ resyncMembership: false, force: true })
      setStep('idle')
    } catch (err) {
      setStep('failed')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      inFlightRef.current = false
    }
  }, [])

  const resetPipeline = useCallback(() => {
    setStep('idle')
    setError(null)
  }, [])

  return {
    pipelineStep: step,
    pipelineError: error,
    pipelineBusy: step !== 'idle' && step !== 'failed',
    runPipeline,
    resetPipeline,
  }
}

export function waitlistPipelineStepMessage(step: WaitlistGroupChatPipelineStep): string {
  switch (step) {
    case 'preparing_wallet':
      return 'Preparing your waitlist wallet…'
    case 'connecting_messaging':
      return 'Connecting messaging…'
    case 'joining_group':
      return 'Adding you to the waitlist group…'
    case 'syncing_group':
      return 'Pulling waitlist chat into this browser…'
    case 'failed':
      return 'Could not open waitlist chat.'
    default:
      return ''
  }
}
