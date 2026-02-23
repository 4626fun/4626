import { useCallback, useState } from 'react'
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
  const [receipt, setReceipt] = useState<string | null>(() => getStoredSiwaReceipt())

  const signIn = useCallback(async (params: SignInParams) => {
    setBusy(true)
    setError(null)
    try {
      const result = await signInWithSiwaAgent({
        ...params,
        signMessage: async (message: string) => signMessageAsync({ message }),
      })
      setLastResult(result)
      setReceipt(getStoredSiwaReceipt())
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
    setReceipt(null)
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

