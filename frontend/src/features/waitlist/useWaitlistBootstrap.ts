import { useCallback, useRef, type MutableRefObject } from 'react'

import { apiFetch } from '@/lib/api/apiBase'
import { clearStoredWaitlistReferralCode } from '@/lib/auth/waitlistEntry'
import { runCanonicalizationPipeline } from '@/lib/auth/canonicalization'

import { mergeCanonicalWaitlistAccount, resolveWaitlistStep, type WaitlistStep } from './waitlistFlowState'
import { isRecoveryRequiredAuthError } from './waitlistAuthState'
import {
  FLOW_TIMEOUT_MS,
  RECOVERY_REQUIRED_BOOTSTRAP_COOLDOWN_MS,
  RECOVERY_REQUIRED_MESSAGE,
  SESSION_FINALIZING_RETRY_MESSAGE,
  TOKENLESS_FINALIZING_BOOTSTRAP_COOLDOWN_MS,
  getWalletProviderCollisionMessage,
  isSessionFinalizingError,
  isWalletProviderCollisionError,
  withTimeout,
} from './waitlistBootstrapUtils'
import { executeWaitlistBootstrapPipeline } from './waitlistBootstrapPipeline'
import { type WaitlistAccountsSummary } from './waitlistAccountTypes'
import { clearWaitlistRecoveryGate } from './waitlistRecoveryGate'
import { clearWaitlistAuthPending } from './waitlistAuthPending'

type UseWaitlistBootstrapParams = {
  activeReferralCode: string | null
  ensureEmbeddedWallet: () => Promise<{ address: string }>
  getAccessToken: () => Promise<string | null>
  privyAuthed: boolean
  setAccount: (account: WaitlistAccountsSummary | null) => void
  setStep: (step: WaitlistStep) => void
  setError: (message: string | null) => void
  setRecoveryRequired: (required: boolean) => void
  finalizingAutoRetryCountRef: MutableRefObject<number>
  finalizingBackgroundRetryCountRef: MutableRefObject<number>
}

export function useWaitlistBootstrap(params: UseWaitlistBootstrapParams) {
  const {
    activeReferralCode,
    ensureEmbeddedWallet,
    getAccessToken,
    privyAuthed,
    setAccount,
    setStep,
    setError,
    setRecoveryRequired,
    finalizingAutoRetryCountRef,
    finalizingBackgroundRetryCountRef,
  } = params

  const tokenlessFinalizingBootstrapCooldownUntilRef = useRef(0)
  const recoveryRequiredBootstrapCooldownUntilRef = useRef(0)
  const bootstrapRequestSeqRef = useRef(0)
  const bootstrapInFlightPromiseRef = useRef<Promise<WaitlistAccountsSummary | null> | null>(null)

  const resetBootstrapCooldowns = useCallback(() => {
    tokenlessFinalizingBootstrapCooldownUntilRef.current = 0
    recoveryRequiredBootstrapCooldownUntilRef.current = 0
    bootstrapRequestSeqRef.current += 1
    bootstrapInFlightPromiseRef.current = null
  }, [])

  const runBootstrap = useCallback(
    async (opts?: {
      waitForTokenHydration?: boolean
      bypassRecoveryCooldown?: boolean
    }): Promise<WaitlistAccountsSummary | null> => {
      const waitForTokenHydration = opts?.waitForTokenHydration === true
      const bypassRecoveryCooldown = opts?.bypassRecoveryCooldown === true
      const recoveryCooldownActive = recoveryRequiredBootstrapCooldownUntilRef.current > Date.now()
      if (!bypassRecoveryCooldown && recoveryCooldownActive) {
        setStep('auth')
        setRecoveryRequired(true)
        clearWaitlistAuthPending()
        const err = new Error(RECOVERY_REQUIRED_MESSAGE) as Error & { recoveryRequired?: boolean; code?: string }
        err.recoveryRequired = true
        err.code = 'RECOVERY_REQUIRED_EMAIL_BOUND'
        throw err
      }

      const readPrivyToken = async (): Promise<string | null> => {
        try {
          return await withTimeout(getAccessToken(), FLOW_TIMEOUT_MS, 'Sign-in token')
        } catch (tokenError: unknown) {
          if (isWalletProviderCollisionError(tokenError)) {
            throw new Error(getWalletProviderCollisionMessage())
          }
          return null
        }
      }

      let token = await readPrivyToken()
      if (!token && waitForTokenHydration) {
        const tokenRetryDelaysMs = [100, 200, 400]
        for (const delayMs of tokenRetryDelaysMs) {
          if (token) break
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
          token = await readPrivyToken()
        }
      }

      if (!token) {
        setStep('auth')
        throw new Error(SESSION_FINALIZING_RETRY_MESSAGE)
      }

      if (tokenlessFinalizingBootstrapCooldownUntilRef.current > Date.now()) {
        setStep('auth')
        throw new Error(SESSION_FINALIZING_RETRY_MESSAGE)
      }

      let pipelineResult
      try {
        pipelineResult = await executeWaitlistBootstrapPipeline({
          token,
          activeReferralCode,
          fetchWaitlistBootstrap: (bootstrapHeaders, body) =>
            withTimeout(
              apiFetch('/api/waitlist/bootstrap', {
                method: 'POST',
                headers: bootstrapHeaders,
                body,
              }),
              FLOW_TIMEOUT_MS,
              'Waitlist bootstrap',
            ),
          runCanonicalization: async (privyToken) => {
            const canonicalization = await withTimeout(
              runCanonicalizationPipeline({ privyToken }),
              FLOW_TIMEOUT_MS,
              'Account sync',
            )
            return {
              onboardingBootstrapped: canonicalization.onboardingBootstrapped,
              onboarding: canonicalization.onboarding,
              flags: {
                needsEmbeddedWallet: canonicalization.flags.needsEmbeddedWallet,
              },
            }
          },
          ensureEmbeddedWallet: () =>
            withTimeout(ensureEmbeddedWallet(), FLOW_TIMEOUT_MS, 'Embedded wallet provisioning'),
        })
      } catch (bootstrapError: unknown) {
        if (isRecoveryRequiredAuthError(bootstrapError)) {
          recoveryRequiredBootstrapCooldownUntilRef.current = Date.now() + RECOVERY_REQUIRED_BOOTSTRAP_COOLDOWN_MS
          clearWaitlistAuthPending()
        }
        throw bootstrapError
      }

      if (pipelineResult.kind === 'requires_privy_auth') {
        tokenlessFinalizingBootstrapCooldownUntilRef.current = Date.now() + TOKENLESS_FINALIZING_BOOTSTRAP_COOLDOWN_MS
        setStep('auth')
        if (privyAuthed) {
          throw new Error(SESSION_FINALIZING_RETRY_MESSAGE)
        }
        return null
      }

      const nextAccount = mergeCanonicalWaitlistAccount(
        pipelineResult.payload,
        pipelineResult.bootstrappedCanonicalWallet,
      )
      setAccount(nextAccount)
      finalizingAutoRetryCountRef.current = 0
      finalizingBackgroundRetryCountRef.current = 0
      tokenlessFinalizingBootstrapCooldownUntilRef.current = 0
      recoveryRequiredBootstrapCooldownUntilRef.current = 0
      setRecoveryRequired(false)
      clearWaitlistRecoveryGate()
      clearWaitlistAuthPending()
      if (activeReferralCode) clearStoredWaitlistReferralCode()
      if (!nextAccount.emailVerified) {
        setStep('auth')
        setError('Verify your email with 4626 to finish creating this account.')
        return nextAccount
      }
      setStep(resolveWaitlistStep({ account: nextAccount }))
      return nextAccount
    },
    [
      activeReferralCode,
      ensureEmbeddedWallet,
      getAccessToken,
      privyAuthed,
      setAccount,
      setError,
      setRecoveryRequired,
      setStep,
      finalizingAutoRetryCountRef,
      finalizingBackgroundRetryCountRef,
    ],
  )

  const requestBootstrap = useCallback(
    (opts?: {
      waitForTokenHydration?: boolean
      forceNew?: boolean
      bypassRecoveryCooldown?: boolean
    }): Promise<WaitlistAccountsSummary | null> => {
      if (!opts?.forceNew && bootstrapInFlightPromiseRef.current) {
        return bootstrapInFlightPromiseRef.current
      }
      const requestSeq = ++bootstrapRequestSeqRef.current
      const managedPromise = runBootstrap({
        waitForTokenHydration: opts?.waitForTokenHydration === true,
        bypassRecoveryCooldown: opts?.bypassRecoveryCooldown === true,
      }).finally(() => {
        if (bootstrapRequestSeqRef.current === requestSeq) {
          bootstrapInFlightPromiseRef.current = null
        }
      })
      bootstrapInFlightPromiseRef.current = managedPromise
      return managedPromise
    },
    [runBootstrap],
  )

  const settleBootstrapAfterRecoverableLoginError = useCallback(
    async (opts?: { bypassRecoveryCooldown?: boolean }): Promise<WaitlistAccountsSummary> => {
      const retryDelaysMs = [300, 600, 900, 1_200]
      finalizingAutoRetryCountRef.current = 0
      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        finalizingAutoRetryCountRef.current = attempt + 1
        try {
          const next = await requestBootstrap({
            waitForTokenHydration: true,
            bypassRecoveryCooldown: opts?.bypassRecoveryCooldown === true,
          })
          if (next) {
            finalizingAutoRetryCountRef.current = 0
            return next
          }
        } catch (bootstrapError: unknown) {
          if (!isSessionFinalizingError(bootstrapError)) throw bootstrapError
        }
        const delayMs = retryDelaysMs[attempt]
        if (typeof delayMs === 'number' && Number.isFinite(delayMs) && delayMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
        }
      }

      throw new Error(SESSION_FINALIZING_RETRY_MESSAGE)
    },
    [finalizingAutoRetryCountRef, requestBootstrap],
  )

  return {
    requestBootstrap,
    settleBootstrapAfterRecoverableLoginError,
    resetBootstrapCooldowns,
    tokenlessFinalizingBootstrapCooldownUntilRef,
    recoveryRequiredBootstrapCooldownUntilRef,
  }
}
