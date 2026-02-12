import { useCallback, useMemo, useState } from 'react'
import { useSignMessage } from 'wagmi'

import { signInWithSiwaAgent, type SignInWithSiwaAgentParams, type SignInWithSiwaAgentResult } from '@/lib/siwaAgentAuth'
import { clearStoredSiwaReceipt, getStoredSiwaReceipt } from '@/lib/siwaReceiptStorage'

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value instanceof Error && value.message.trim()) return value.message.trim()
  return fallback
}

type SignInParams = Omit<SignInWithSiwaAgentParams, 'signMessage'>

export function useSiwaAgentAuth() {
  const { signMessageAsync } = useSignMessage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SignInWithSiwaAgentResult | null>(null)
  const [version, setVersion] = useState(0)

  const receipt = useMemo(() => {
    return getStoredSiwaReceipt()
  }, [version])

  const signIn = useCallback(async (params: SignInParams) => {
    setBusy(true)
    setError(null)
    try {
      const result = await signInWithSiwaAgent({
        ...params,
        signMessage: async (message: string) => signMessageAsync({ message }),
      })
      setLastResult(result)
      setVersion((v) => v + 1)
      return result
    } catch (e: unknown) {
      const message = toErrorMessage(e, 'SIWA sign-in failed')
      setError(message)
      return null
    } finally {
      setBusy(false)
    }
  }, [signMessageAsync])

  const signOut = useCallback(() => {
    clearStoredSiwaReceipt()
    setLastResult(null)
    setError(null)
    setVersion((v) => v + 1)
  }, [])

  return {
    busy,
    error,
    receipt,
    hasReceipt: Boolean(receipt),
    lastResult,
    signIn,
    signOut,
  }
}

