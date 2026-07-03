import { useEffect, useRef } from 'react'

import {
  isWaitlistWalletSignInCancellation,
  mapWaitlistWalletSignInError,
  runWaitlistReturningWalletSignIn,
} from '@/features/waitlist/waitlistPrivySession'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { useSafeLogin, useSafePrivy } from '@/lib/privy/safeHooks'

const WALLET_SIGN_IN_TIMEOUT_MS = 90_000
const WALLET_READY_POLL_MS = 100
const WALLET_READY_FORCE_MS = 4_000

type WaitlistReturningWalletSignInRunnerProps = {
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
  const signInStartedRef = useRef(false)

  useEffect(() => {
    privyRef.current = privy
    loginRef.current = login
    privyClientStatusRef.current = privyClientStatus
    onSuccessRef.current = props.onSuccess
    onFailureRef.current = props.onFailure
  })

  useEffect(() => {
    let active = true
    let readyPollId = 0
    let timeoutId = 0

    const isPrivyRuntimeReady = () =>
      privyClientStatusRef.current === 'ready' || privyRef.current.ready === true

    const runSignIn = () => {
      if (!active || signInStartedRef.current) return
      signInStartedRef.current = true

      timeoutId = window.setTimeout(() => {
        if (!active) return
        active = false
        onFailureRef.current(
          'Wallet sign-in timed out. Try a private window with one wallet extension enabled, or sign in with email.',
        )
      }, WALLET_SIGN_IN_TIMEOUT_MS)

      void (async () => {
        try {
          const address = await runWaitlistReturningWalletSignIn({
            privy: privyRef.current,
            login: (input) => loginRef.current(input),
          })
          if (!active) return
          active = false
          window.clearTimeout(timeoutId)
          onSuccessRef.current(address)
        } catch (signInError) {
          if (!active) return
          active = false
          window.clearTimeout(timeoutId)
          onFailureRef.current(
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
        if (!active) return
        if (isPrivyRuntimeReady() || Date.now() - startedAt >= WALLET_READY_FORCE_MS) {
          runSignIn()
          return
        }
        readyPollId = window.setTimeout(poll, WALLET_READY_POLL_MS)
      }
      poll()
    }

    waitForReadyThenRun()

    return () => {
      active = false
      window.clearTimeout(readyPollId)
      window.clearTimeout(timeoutId)
      signInStartedRef.current = false
    }
  }, [])

  return null
}
