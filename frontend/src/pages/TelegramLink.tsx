import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { PageMeta } from '@/components/seo/PageMeta'
import { Alert } from '@/components/ui/Alert'

import {
  fetchTelegramLinkEmailVerificationState,
  formatTelegramSessionError,
  getPrivyEmailState,
  getTelegramLinkSuccessMessage,
  getTelegramLinkViewState,
  isPrivyEmailAlreadyLinkedError,
  isPrivyTelegramAlreadyLinkedError,
  isTelegramLinkEmailVerificationRequiredError,
  linkPrivyTelegramInMiniApp,
  normalizeTelegramLinkUiMessage,
  pollTelegramLinkEmailVerification,
  resolveTelegramLinkAuthSettlementPlan,
  resolveTelegramLinkEmailAuthAction,
  shouldAutoRefreshTelegramLinkEmail,
  shouldAutoStartTelegramLink,
  shouldResetTelegramMiniAppSessionForLinkError,
  shouldShowResetTelegramLinkAccount,
  shouldShowRetryTelegramSession,
  useTelegramLinkFlow,
  waitForTelegramLinkPrivyAuth,
} from './telegramLinkFlow'

export {
  fetchTelegramLinkEmailVerificationState,
  formatTelegramSessionError,
  getPrivyEmailState,
  getTelegramLinkSuccessMessage,
  getTelegramLinkViewState,
  isPrivyEmailAlreadyLinkedError,
  isPrivyTelegramAlreadyLinkedError,
  isTelegramLinkEmailVerificationRequiredError,
  linkPrivyTelegramInMiniApp,
  normalizeTelegramLinkUiMessage,
  pollTelegramLinkEmailVerification,
  resolveTelegramLinkAuthSettlementPlan,
  resolveTelegramLinkEmailAuthAction,
  shouldAutoRefreshTelegramLinkEmail,
  shouldAutoStartTelegramLink,
  shouldResetTelegramMiniAppSessionForLinkError,
  shouldShowResetTelegramLinkAccount,
  shouldShowRetryTelegramSession,
  waitForTelegramLinkPrivyAuth,
} from './telegramLinkFlow'

export function TelegramLink() {
  const {
    linkState,
    emailState,
    sessionState,
    privyAuthenticated,
    telegramLinkContext,
    statusView,
    showRetrySessionButton,
    showResetAccountButton,
    working,
    onRetrySession,
    onRetryLink,
    onResetAccount,
    onSignIn,
  } = useTelegramLinkFlow()

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-2xl items-center px-4 py-10 sm:px-6">
      <PageMeta title="Telegram Link" description="Link your Telegram identity to 4626." canonicalPath="/telegram/link" />
      <div className="w-full rounded-3xl border border-white/10 bg-black/40 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8">
        <div className="space-y-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-300/80">Telegram Mini App</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Link Telegram to your 4626 account</h1>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            This page is only for the Telegram account-link handshake. It verifies the Mini App session first, then binds your
            Telegram identity after you verify your email with 4626.
          </p>
        </div>

        <Alert variant={statusView.statusVariant} title={statusView.statusTitle} className="mt-6">
          {statusView.statusMessage}
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
          {statusView.canSignIn ? (
            <button
              type="button"
              onClick={() => void onSignIn()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-300"
            >
              {privyAuthenticated ? 'Continue' : 'Continue with 4626'}
            </button>
          ) : null}

          {showRetrySessionButton ? (
            <button
              type="button"
              onClick={onRetrySession}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Retry Telegram session
            </button>
          ) : null}

          {showResetAccountButton ? (
            <button
              type="button"
              onClick={() => void onResetAccount()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
            >
              Sign out and retry
            </button>
          ) : null}

          {statusView.canRetryLink ? (
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

        {working ? (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Working...</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
