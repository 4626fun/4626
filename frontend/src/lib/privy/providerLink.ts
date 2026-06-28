import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import {
  isPrivyRedirectUrlNotAllowedError,
  sanitizeCrossAppRedirectUrlForAuth,
} from '@/hooks/siweAuthCrossApp'
import { readPrivyTelegramLaunchParams } from '@/lib/telegram/telegramWebApp'

import { readPrivyAccessTokenWithRetries } from './accessToken'

export type PrivyOAuthProvider =
  | 'email'
  | 'google'
  | 'apple'
  | 'twitter'
  | 'telegram'
  | 'tiktok'
  | 'external_eoa'

type PrivyLoginFn = ((input: { loginMethods: string[] | readonly string[] }) => void) | null | undefined

class AccountsLinkError extends Error {
  readonly status: number
  readonly recoveryRequired: boolean
  readonly code: string | null

  constructor(message: string, options?: { status?: number; recoveryRequired?: boolean; code?: string | null }) {
    super(message)
    this.name = 'AccountsLinkError'
    this.status = options?.status ?? 500
    this.recoveryRequired = options?.recoveryRequired ?? false
    this.code = options?.code ?? null
  }
}

const PRIVY_LINK_METHODS: Record<PrivyOAuthProvider, string[]> = {
  email: ['linkEmail', 'linkEmailAccount'],
  google: ['linkGoogle', 'linkGoogleAccount'],
  apple: ['linkApple', 'linkAppleAccount'],
  twitter: ['linkTwitter', 'linkTwitterAccount'],
  telegram: ['linkTelegram'],
  tiktok: ['linkTiktok', 'linkTikTok', 'linkTiktokAccount', 'linkTikTokAccount'],
  external_eoa: ['linkWallet'],
}

const PRIVY_UNLINK_METHODS: Record<PrivyOAuthProvider, string[]> = {
  email: ['unlinkEmail', 'unlinkEmailAccount'],
  google: ['unlinkGoogle', 'unlinkGoogleAccount'],
  apple: ['unlinkApple', 'unlinkAppleAccount'],
  twitter: ['unlinkTwitter', 'unlinkTwitterAccount'],
  telegram: ['unlinkTelegram'],
  tiktok: ['unlinkTiktok', 'unlinkTikTok', 'unlinkTiktokAccount', 'unlinkTikTokAccount'],
  external_eoa: ['unlinkWallet'],
}

async function callPrivyMethod(
  target: unknown,
  methodNames: string[],
  args: unknown[] = [],
  options?: { recoverableErrors?: boolean },
): Promise<boolean> {
  if (!target || typeof target !== 'object') return false
  const record = target as Record<string, unknown>
  let attempted = false
  let lastError: unknown = null

  for (const methodName of methodNames) {
    const method = record[methodName]
    if (typeof method !== 'function') continue
    attempted = true
    try {
      await (method as (...params: unknown[]) => unknown).apply(target, args)
      return true
    } catch (error) {
      if (!options?.recoverableErrors || !isRecoverableOAuthLinkError(error)) throw error
      lastError = error
    }
  }

  if (!attempted) return false
  if (options?.recoverableErrors) {
    throw (
      lastError ??
      new Error('Account linking is unavailable in this browser. Try again or use a private window.')
    )
  }
  return false
}

export function isRecoverableOAuthLinkError(error: unknown): boolean {
  if (isPrivyRedirectUrlNotAllowedError(error)) return true
  const message = String((error as { message?: unknown })?.message ?? '').trim().toLowerCase()
  if (!message) return false
  return (
    message.includes('authentication failed') ||
    message.includes('invalid code') ||
    message.includes('invalid authorization code') ||
    message.includes('authorization code has expired') ||
    message.includes('authorization code is invalid') ||
    message.includes('oauth/init') ||
    message.includes('oauth state') ||
    message.includes('redirect url is not allowed')
  )
}

function assertPrivyAuthenticated(privy: unknown): void {
  const record = privy && typeof privy === 'object' ? (privy as Record<string, unknown>) : null
  if (record?.authenticated !== true) {
    throw new Error('Sign in before linking an account.')
  }
}

function parseAccountsLinkFailure(
  response: Response,
  payload: ApiEnvelope<AccountSetupMe> | null,
  provider: string,
): AccountsLinkError {
  const envelope = payload as (ApiEnvelope<AccountSetupMe> & {
    recoveryRequired?: unknown
    code?: unknown
  }) | null
  const recoveryRequired = Boolean(envelope?.recoveryRequired)
  const code = typeof envelope?.code === 'string' ? envelope.code : null
  const message =
    typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error.trim()
      : recoveryRequired
        ? 'Recovery required: this identity is already linked to another account.'
        : `Could not save ${provider.replace(/_/g, ' ')} to your 4626 account.`
  return new AccountsLinkError(message, {
    status: response.status,
    recoveryRequired,
    code,
  })
}

function isMissingProviderLinkError(provider: string, message: string): boolean {
  const normalizedProvider = provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`No linked value found for provider "${normalizedProvider}"\\.`, 'i')
  return pattern.test(message)
}

async function runWithSanitizedRedirect<T>(work: () => T | Promise<T>): Promise<T> {
  const restore = sanitizeCrossAppRedirectUrlForAuth()
  try {
    return await work()
  } finally {
    restore?.()
  }
}

async function readPrivyToken(getAccessToken: (() => Promise<string | null>) | null | undefined): Promise<string> {
  const token = await readPrivyAccessTokenWithRetries({
    read: getAccessToken ?? null,
  })
  if (!token) throw new Error('Could not verify your session. Please try again.')
  return token
}

async function postAccountsLink(params: {
  provider: string
  getAccessToken: (() => Promise<string | null>) | null | undefined
}): Promise<AccountSetupMe> {
  const token = await readPrivyToken(params.getAccessToken)
  const response = await apiFetch('/api/accounts/link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Privy-Token': token,
    },
    body: JSON.stringify({ provider: params.provider, value: null }),
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountSetupMe> | null
  if (!response.ok || !payload?.success || !payload.data) {
    throw parseAccountsLinkFailure(response, payload, params.provider)
  }
  return payload.data
}

async function postAccountsUnlink(params: {
  provider: string
  getAccessToken: (() => Promise<string | null>) | null | undefined
  value?: string | null
}): Promise<AccountSetupMe> {
  const token = await readPrivyToken(params.getAccessToken)
  const response = await apiFetch('/api/accounts/unlink', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Privy-Token': token,
    },
    body: JSON.stringify({ provider: params.provider, value: params.value ?? null }),
  })
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<AccountSetupMe> | null
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || `Could not disconnect ${params.provider}.`)
  }
  return payload.data
}

export async function syncAccountsProviderLink(params: {
  provider: string
  getAccessToken: (() => Promise<string | null>) | null | undefined
  attempts?: number
  delayMs?: number
}): Promise<AccountSetupMe> {
  const attempts = Math.max(1, Number(params.attempts ?? 4))
  const delayMs = Math.max(0, Number(params.delayMs ?? 500))
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await postAccountsLink(params)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '')
      if (!isMissingProviderLinkError(params.provider, message)) throw error
      lastError = error
      if (attempt < attempts - 1 && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw (
    lastError ??
    new Error(`${params.provider.replace(/_/g, ' ')} link is still syncing. Please retry in a moment.`)
  )
}

export async function linkPrivyProvider(params: {
  privy: unknown
  provider: PrivyOAuthProvider
  login?: PrivyLoginFn
}): Promise<boolean> {
  const { privy, provider, login } = params
  assertPrivyAuthenticated(privy)
  let navigationPending = false

  await runWithSanitizedRedirect(async () => {
    if (provider === 'external_eoa') {
      const called = await callPrivyMethod(privy, PRIVY_LINK_METHODS.external_eoa)
      if (!called && typeof login === 'function') {
        login({ loginMethods: ['wallet'] })
        navigationPending = true
      }
      return
    }

    if (provider === 'telegram') {
      const launchParams = readPrivyTelegramLaunchParams()
      if (!launchParams?.initDataRaw) {
        throw new Error('Telegram linking must start from Telegram. Run /link in the bot, then open the Mini App.')
      }
      const called = await callPrivyMethod(privy, PRIVY_LINK_METHODS.telegram, [{ launchParams }])
      if (!called) {
        throw new Error('Telegram linking is unavailable in this client. Re-open from Telegram and retry.')
      }
      return
    }

    const methodNames = PRIVY_LINK_METHODS[provider]
    let called = false

    if (provider === 'twitter') {
      try {
        called = await callPrivyMethod(privy, methodNames, [], { recoverableErrors: true })
      } catch (error) {
        if (!isRecoverableOAuthLinkError(error)) throw error
      }
      if (!called && typeof login === 'function') {
        login({ loginMethods: ['twitter'] })
        called = true
        navigationPending = true
      }
    } else {
      called = await callPrivyMethod(privy, methodNames)
      if (!called && typeof login === 'function' && provider === 'email') {
        login({ loginMethods: ['email'] })
        called = true
        navigationPending = true
      }
    }

    if (!called) {
      throw new Error(`${provider.replace(/_/g, ' ')} linking is unavailable in this client.`)
    }
  })

  return navigationPending
}

export async function unlinkPrivyProvider(params: {
  privy: unknown
  provider: PrivyOAuthProvider
  value?: string | null
}): Promise<void> {
  const methodNames = PRIVY_UNLINK_METHODS[params.provider]
  const called = await callPrivyMethod(
    params.privy,
    methodNames,
    params.value ? [{ value: params.value }] : [],
  )
  if (!called) {
    throw new Error(`${params.provider.replace(/_/g, ' ')} unlink is unavailable in this client.`)
  }
}

export async function linkAndSyncPrivyProvider(params: {
  privy: unknown
  provider: PrivyOAuthProvider
  login?: PrivyLoginFn
  getAccessToken: (() => Promise<string | null>) | null | undefined
}): Promise<AccountSetupMe | null> {
  const navigationPending = await linkPrivyProvider(params)
  if (navigationPending) return null
  return syncAccountsProviderLink({
    provider: params.provider,
    getAccessToken: params.getAccessToken,
  })
}

export async function unlinkAndSyncPrivyProvider(params: {
  privy: unknown
  provider: PrivyOAuthProvider
  getAccessToken: (() => Promise<string | null>) | null | undefined
  value?: string | null
}): Promise<AccountSetupMe> {
  await unlinkPrivyProvider(params)
  return postAccountsUnlink({
    provider: params.provider,
    getAccessToken: params.getAccessToken,
    value: params.value ?? null,
  })
}
