import { useEffect, useRef } from 'react'

import {
  isWaitlistWalletSignInCancellation,
  mapWaitlistWalletSignInError,
  runWaitlistReturningWalletSignIn,
} from '@/features/waitlist/waitlistPrivySession'
import { usePrivyClientStatus } from '@/lib/privy/client'
import {
  clearPrivySessionMarkerCookie,
  isLocalDevPrivySessionMarkerMode,
} from '@/lib/privy/loopbackSessionMarkerShim'
import { useSafeLogin, useSafePrivy } from '@/lib/privy/safeHooks'

const WALLET_SIGN_IN_TIMEOUT_MS = 90_000
const WALLET_READY_POLL_MS = 100
const WALLET_READY_FORCE_MS = 8_000
type WaitlistReturningWalletSignInRunnerProps = {
  signInAttempt: number
  onSuccess: (address: string) => void
  onFailure: (message: string | null) => void
}

export function WaitlistReturningWalletSignInRunner(props: WaitlistReturningWalletSignInRunnerProps) {
  const privy = useSafePrivy()
  const privyClientStatus = usePrivyClientStatus()
  const { login } = useSafeLogin()
  const privyRef = useRef(privy)
  const loginRef = useRef(login)
  const privyClientStatusRef = useRef(privyClientStatus)
  const onSuccessRef = useRef(props.onSuccess)
  const onFailureRef = useRef(props.onFailure)
  const activeAttemptRef = useRef(props.signInAttempt)

  useEffect(() => {
    privyRef.current = privy
    loginRef.current = login
    privyClientStatusRef.current = privyClientStatus
    onSuccessRef.current = props.onSuccess
    onFailureRef.current = props.onFailure
    activeAttemptRef.current = props.signInAttempt
  })

  useEffect(() => {
    const attempt = props.signInAttempt
    let readyPollId = 0
    let timeoutId = 0
    let disposed = false

    const isActiveAttempt = () => !disposed && activeAttemptRef.current === attempt

    const isPrivyRuntimeReady = () =>
      privyClientStatusRef.current === 'ready' || privyRef.current.ready === true

    const failAttempt = (message: string | null) => {
      if (!isActiveAttempt()) return
      window.clearTimeout(timeoutId)
      if (isLocalDevPrivySessionMarkerMode()) {
        clearPrivySessionMarkerCookie()
      }
      onFailureRef.current(message)
    }

    const succeedAttempt = (address: string) => {
      if (!isActiveAttempt()) return
      window.clearTimeout(timeoutId)
      onSuccessRef.current(address)
    }

    const runSignIn = () => {
      if (!isActiveAttempt()) return

      timeoutId = window.setTimeout(() => {
        failAttempt(
          'Wallet sign-in timed out. Try a private window with one wallet extension enabled, or sign in with email.',
        )
      }, WALLET_SIGN_IN_TIMEOUT_MS)

      void (async () => {
        try {
          const address = await runWaitlistReturningWalletSignIn({
            privy: privyRef.current,
            login: (input) => loginRef.current(input),
          })
          succeedAttempt(address)
        } catch (signInError) {
          failAttempt(
            isWaitlistWalletSignInCancellation(signInError)
              ? null
              : mapWaitlistWalletSignInError(signInError),
          )
        }
      })()
    }

    const waitForReadyThenRun = () => {
      const startedAt = Date.now()
      const poll = () => {
        if (!isActiveAttempt()) return
        if (isPrivyRuntimeReady()) {
          runSignIn()
          return
        }
        if (Date.now() - startedAt >= WALLET_READY_FORCE_MS) {
          failAttempt('Wallet sign-in is still starting. Refresh the page and try again.')
          return
        }
        readyPollId = window.setTimeout(poll, WALLET_READY_POLL_MS)
      }
      poll()
    }

    waitForReadyThenRun()

    return () => {
      disposed = true
      window.clearTimeout(readyPollId)
      window.clearTimeout(timeoutId)
    }
  }, [props.signInAttempt])

  return null
}
