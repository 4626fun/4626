import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'

import { PageMeta } from '@/components/seo/PageMeta'
import { Alert } from '@/components/ui/Alert'
import { apiFetch } from '@/lib/apiBase'
import {
  clearStoredTelegramMiniAppLinkContext,
  resolveTelegramMiniAppLinkContext,
  stripTelegramMiniAppLinkParams,
} from '@/lib/telegramMiniAppLink'
import {
  ensureTelegramMiniAppSession,
  isTelegramMiniAppContext,
  loadTelegramWebApp,
  setupTelegramMiniAppUi,
} from '@/lib/telegramWebApp'
import { useSiweAuth } from '@/hooks/useSiweAuth'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type TelegramLinkCompleteResponse = {
  linked: boolean
}

function formatTelegramSessionError(error: string, statusCode: number): string {
  const normalized = String(error ?? '').trim().toLowerCase()
  if (statusCode === 409 || normalized.includes('replay')) {
    return 'This Telegram Mini App session was already used. Re-open the Mini App from Telegram, then tap Link again.'
  }
  if (statusCode === 410 || normalized.includes('expired')) {
    return 'This Telegram Mini App session expired. Re-open the Mini App from Telegram and retry.'
  }
  if (normalized.includes('disabled')) {
    return 'Telegram Mini App linking is not enabled for this chat yet.'
  }
  if (normalized.includes('unavailable')) {
    return 'Telegram Mini App session unavailable. Open this flow from Telegram.'
  }
  return 'Could not verify your Telegram Mini App session. Re-open the Mini App from Telegram and retry.'
}

export function TelegramLink() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const privy = usePrivy()
  const { signIn } = useSiweAuth()

  const privyReady = Boolean(privy.ready)
  const privyAuthenticated = Boolean(privy.authenticated)
  const getAccessToken = useMemo(
    () =>
      typeof privy.getAccessToken === 'function'
        ? (privy.getAccessToken as () => Promise<string | null>)
        : async () => null,
    [privy.getAccessToken],
  )

  const telegramLinkContext = useMemo(() => resolveTelegramMiniAppLinkContext(searchParams), [searchParams])

  const [sessionState, setSessionState] = useState<'verifying' | 'ready' | 'error'>('verifying')
  const [sessionToken, setSessionToken] = useState('')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [linkState, setLinkState] = useState<'idle' | 'authenticating' | 'linking' | 'linked' | 'error'>('idle')
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
  const linkAttemptRef = useRef('')

  const verifySession = useCallback(async () => {
    setSessionState('verifying')
    setSessionError(null)
    setSessionToken('')

    const session = await ensureTelegramMiniAppSession()
    if (!session.ok) {
      setSessionState('error')
      setSessionError(formatTelegramSessionError(session.error, session.statusCode))
      return null
    }

    setSessionState('ready')
    setSessionToken(session.session.sessionToken)
    return session.session
  }, [])

  useEffect(() => {
    let cancelled = false
    let teardown: (() => void) | null = null

    void (async () => {
      await loadTelegramWebApp().catch(() => null)
      if (cancelled) return
      teardown = setupTelegramMiniAppUi({ requestExpand: true })
      if (!isTelegramMiniAppContext()) {
        setSessionState('error')
        setSessionError('Open this link from Telegram so 4626 can verify your Mini App session.')
        return
      }
      await verifySession()
    })()

    return () => {
      cancelled = true
      teardown?.()
    }
  }, [verifySession])

  useEffect(() => {
    if (!telegramLinkContext) return
    if (sessionState !== 'ready' || !sessionToken) return
    if (!privyReady || !privyAuthenticated) return
    if (linkState === 'linking' || linkState === 'linked') return
    if (linkAttemptRef.current === telegramLinkContext.linkToken) return

    linkAttemptRef.current = telegramLinkContext.linkToken
    void (async () => {
      setLinkState('linking')
      setLinkMessage('Linking your Telegram identity to your 4626 account...')

      const accessToken = (await getAccessToken().catch(() => null))?.trim() ?? ''
      if (!accessToken) {
        throw new Error('Could not read your 4626 session. Sign in again and retry linking.')
      }

      const res = await apiFetch('/api/telegram/miniapp/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-privy-token': accessToken,
        },
        body: JSON.stringify({
          token: telegramLinkContext.linkToken,
          telegramUsername: telegramLinkContext.telegramUsername,
          miniAppSessionToken: sessionToken,
        }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<TelegramLinkCompleteResponse> | null
      if (!res.ok || !json?.success || json.data?.linked !== true) {
        const message =
          typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : 'Telegram linking failed.'
        if (res.status === 410 || /expired/i.test(message)) {
          clearStoredTelegramMiniAppLinkContext()
        }
        throw new Error(message)
      }

      clearStoredTelegramMiniAppLinkContext()
      const cleaned = stripTelegramMiniAppLinkParams(searchParams)
      const next = cleaned.toString()
      navigate(
        {
          pathname: '/telegram/link',
          search: next ? `?${next}` : '',
        },
        { replace: true },
      )
      setLinkState('linked')
      setLinkMessage('Telegram linked successfully. You can return to Telegram or continue into 4626.')
    })().catch((error: unknown) => {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Could not complete Telegram linking. Retry in a moment.'
      setLinkState('error')
      setLinkMessage(message)
      linkAttemptRef.current = ''
    })
  }, [
    getAccessToken,
    linkState,
    navigate,
    privyAuthenticated,
    privyReady,
    searchParams,
    sessionState,
    sessionToken,
    telegramLinkContext,
  ])

  const onRetrySession = useCallback(() => {
    void verifySession()
  }, [verifySession])

  const onRetryLink = useCallback(() => {
    linkAttemptRef.current = ''
    setLinkState('idle')
    setLinkMessage(null)
  }, [])

  const onSignIn = useCallback(async () => {
    setLinkState('authenticating')
    setLinkMessage('Open the 4626 sign-in prompt to continue.')
    try {
      await signIn({ method: 'privy' })
      setLinkState('idle')
      setLinkMessage(null)
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Failed to start 4626 sign-in.'
      setLinkState('error')
      setLinkMessage(message)
    }
  }, [signIn])

  const statusVariant = sessionState === 'error' || linkState === 'error' ? 'warning' : linkState === 'linked' ? 'success' : 'info'
  const statusTitle =
    sessionState === 'verifying'
      ? 'Verifying Telegram session'
      : sessionState === 'error'
        ? 'Telegram linking needs attention'
        : linkState === 'linked'
          ? 'Telegram account linked'
          : linkState === 'linking'
            ? 'Linking Telegram account'
            : linkState === 'authenticating'
              ? 'Sign in to 4626'
              : 'Ready to link'

  const canSignIn = sessionState === 'ready' && Boolean(telegramLinkContext) && !privyAuthenticated && linkState !== 'authenticating'
  const canRetryLink = sessionState === 'ready' && Boolean(telegramLinkContext) && linkState === 'error'

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <PageMeta title="Telegram Link" description="Link your Telegram identity to 4626." canonicalPath="/telegram/link" />
      <div className="w-full rounded-3xl border border-white/10 bg-black/40 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-300/80">Telegram Mini App</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Link Telegram to your 4626 account</h1>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            This page is only for the Telegram account-link handshake. It verifies the Mini App session first, then binds the
            Telegram identity to the 4626 account you sign into here.
          </p>
        </div>

        <Alert variant={statusVariant} title={statusTitle} className="mt-6">
          {sessionError ??
            linkMessage ??
            (sessionState === 'verifying'
              ? 'Checking your Telegram Mini App session...'
              : privyAuthenticated
                ? 'Your 4626 session is ready. Finishing the Telegram link now.'
                : 'Sign in with your existing 4626 account to finish linking.')}
        </Alert>

        {!telegramLinkContext && linkState !== 'linked' ? (
          <div className="mt-4 text-sm text-zinc-400">
            The one-time Telegram link token is missing. Open Telegram and run <span className="font-mono text-zinc-200">/link</span>{' '}
            again to get a fresh Mini App launch.
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Telegram session</div>
            <div className="mt-2 text-sm font-medium text-zinc-100">
              {sessionState === 'ready' ? 'Verified' : sessionState === 'error' ? 'Needs retry' : 'Checking'}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">4626 account</div>
            <div className="mt-2 text-sm font-medium text-zinc-100">
              {privyAuthenticated ? 'Signed in' : linkState === 'authenticating' ? 'Waiting for sign-in' : 'Sign-in required'}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {canSignIn ? (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-300"
            >
              Continue with 4626
            </button>
          ) : null}

          {sessionState === 'error' ? (
            <button
              type="button"
              onClick={onRetrySession}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Retry Telegram session
            </button>
          ) : null}

          {canRetryLink ? (
            <button
              type="button"
              onClick={onRetryLink}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Retry link
            </button>
          ) : null}

          {linkState === 'linked' ? (
            <>
              <Link
                to="/swap"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-emerald-300"
              >
                Open 4626
              </Link>
              <Link
                to="/accounts"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              >
                Manage accounts
              </Link>
            </>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-zinc-400">
          <div className="font-medium uppercase tracking-[0.18em] text-zinc-500">Notes</div>
          <div className="mt-2">
            Keep this flow inside Telegram while linking. If the Mini App session expires or gets consumed, reopen the Mini App
            from Telegram to mint a fresh session before retrying.
          </div>
        </div>

        {(sessionState === 'verifying' || linkState === 'authenticating' || linkState === 'linking') ? (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Working...</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
