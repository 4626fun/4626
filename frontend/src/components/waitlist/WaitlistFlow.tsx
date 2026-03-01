import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAppBaseUrl, getWaitlistReferralBaseUrl } from '@/lib/host'
import { trackEvent } from '@/lib/analytics'
import { useAccount, usePublicClient, useSignMessage } from 'wagmi'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useFarcasterAuth } from '@/hooks/useFarcasterAuth'
import { isPrivyClientEnabled } from '@/lib/flags'
import { usePrivyClientStatus, ZORA_PRIVY_APP_ID } from '@/lib/privy/client'
import {
  toViemAccount,
  useBaseAccountSdk,
  useConnectWallet,
  useCreateWallet,
  useCrossAppAccounts,
  useLogin,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth'
import { base } from 'wagmi/chains'
import { getAddress, isAddress } from 'viem'
import { useMiniAppContext } from '@/hooks'
import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import type {
  ActionKey,
  ContactPreference,
  FlowState,
  Persona,
  Variant,
  VerificationClaim,
  VerificationMethod,
  VerificationState,
  WaitlistState,
} from './waitlistTypes'
import { VerifyStep } from './steps/VerifyStep'
import { DoneStep } from './steps/DoneStep'
import { useWaitlistApi } from './useWaitlistApi'
import { useWaitlistVerification } from './useWaitlistVerification'
import { useWaitlistReferral, getStoredReferralCode } from './useWaitlistReferral'
import { resolveDoneStepDeployAccessState } from './_waitlistDeployAccess'
import {
  deriveOwnerInstallMappingStatus,
  extractZoraCrossAppAccounts,
  extractZoraProviderAddresses,
  resolveCanonicalZoraCswCandidate,
  selectZoraCrossAppAuthAction,
} from './ownerInstallMapping'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EVM_RE = /^0x[a-fA-F0-9]{40}$/
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]+$/
const BASE_EASE = [0.4, 0, 0.2, 1] as const
const BASE_MOTION_MS = 0.2
const SESSION_TOKEN_KEY = 'cv_siwe_session_token'
const HANDOFF_HASH_KEY = 'cv_session'

const CREATOR_COIN_READ_ABI = [
  {
    inputs: [],
    name: 'payoutRecipient',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalOwners',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'index', type: 'uint256' }],
    name: 'ownerAt',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

let warnedPrivyHookFailure = false
function warnPrivyHookFailure(scope: string, error: unknown) {
  if (warnedPrivyHookFailure) return
  warnedPrivyHookFailure = true
  console.warn(`[waitlist] Privy hook unavailable in ${scope}; falling back to non-Privy mode`, error)
}

function useSafePrivyHook(enabled: boolean) {
  try {
    const value = usePrivy() as any
    if (!enabled) {
      return {
        ready: false,
        authenticated: false,
        user: null,
        logout: async () => {},
        linkWallet: async () => {},
        getAccessToken: async () => null,
      } as any
    }
    return value
  } catch (error) {
    warnPrivyHookFailure('usePrivy', error)
    return {
      ready: false,
      authenticated: false,
      user: null,
      logout: async () => {},
      linkWallet: async () => {},
      getAccessToken: async () => null,
    } as any
  }
}

function useSafeConnectWalletHook(options: any, enabled: boolean) {
  try {
    const value = useConnectWallet(options) as any
    if (!enabled) return { connectWallet: async () => {} } as any
    return value
  } catch (error) {
    warnPrivyHookFailure('useConnectWallet', error)
    return { connectWallet: async () => {} } as any
  }
}

function useSafeLoginHook(options: any, enabled: boolean) {
  try {
    const value = useLogin(options) as any
    if (!enabled) return { login: async () => {} } as any
    return value
  } catch (error) {
    warnPrivyHookFailure('useLogin', error)
    return { login: async () => {} } as any
  }
}

function useSafeWalletsHook(enabled: boolean) {
  try {
    const value = useWallets() as any
    if (!enabled) return { wallets: [], ready: false } as any
    return value
  } catch (error) {
    warnPrivyHookFailure('useWallets', error)
    return { wallets: [], ready: false } as any
  }
}

function useSafeCreateWalletHook(enabled: boolean) {
  try {
    const value = useCreateWallet() as any
    if (!enabled) return { createWallet: async () => null } as any
    return value
  } catch (error) {
    warnPrivyHookFailure('useCreateWallet', error)
    return { createWallet: async () => null } as any
  }
}

function useSafeCrossAppAccountsHook(enabled: boolean) {
  try {
    const value = useCrossAppAccounts() as any
    if (!enabled) {
      return {
        loginWithCrossAppAccount: null as null | ((args: { appId: string }) => Promise<unknown>),
        linkCrossAppAccount: null as null | ((args: { appId: string }) => Promise<unknown>),
      } as any
    }
    return value
  } catch (error) {
    warnPrivyHookFailure('useCrossAppAccounts', error)
    return {
      loginWithCrossAppAccount: null as null | ((args: { appId: string }) => Promise<unknown>),
      linkCrossAppAccount: null as null | ((args: { appId: string }) => Promise<unknown>),
    } as any
  }
}

function useSafeBaseAccountSdkHook(enabled: boolean) {
  try {
    const value = useBaseAccountSdk() as any
    if (!enabled) return { baseAccountSdk: null } as any
    return value
  } catch (error) {
    warnPrivyHookFailure('useBaseAccountSdk', error)
    return { baseAccountSdk: null } as any
  }
}

type PatchAction<T> = { type: 'patch'; patch: Partial<T> } | { type: 'reset' }
type WaitlistAction =
  | PatchAction<WaitlistState>
  | { type: 'setActions'; actions: Record<ActionKey, boolean> }
  | { type: 'markAction'; key: ActionKey }

const EMPTY_ACTION_STATE: Record<ActionKey, boolean> = {
  // Legacy actions
  shareX: false,
  copyLink: false,
  share: false,
  follow: false,
  saveApp: false,
  // Social actions (verified)
  farcaster: false,
  baseApp: false,
  zora: false,
  x: false,
  discord: false,
  telegram: false,
  // Bonus actions (honor system)
  github: false,
  tiktok: false,
  instagram: false,
  reddit: false,
}

const initialFlowState: FlowState = {
  persona: 'creator', // Default to creator - simplified flow
  step: 'verify', // Start with wallet connection + Privy auth
  contactPreference: 'email',
  email: '',
  emailOptOut: false,
  busy: false,
  error: null,
  doneEmail: null,
}

const initialVerificationState: VerificationState = {
  verifiedWallet: null,
  verifiedWalletMethod: null,
  verifiedSolana: null,
  privyVerifyBusy: false,
  privyVerifyError: null,
  baseSubAccount: null,
  baseSubAccountBusy: false,
  baseSubAccountError: null,
}

const initialWaitlistState: WaitlistState = {
  creatorCoin: null,
  creatorCoinDeclaredMissing: false,
  creatorCoinBusy: false,
  claimCoinBusy: false,
  claimCoinError: null,
  referralCodeTaken: false,
  claimReferralCode: '',
  inviteToast: null,
  inviteTemplateIdx: 0,
  referralCode: null,
  shareBusy: false,
  shareToast: null,
  actionsDone: { ...EMPTY_ACTION_STATE },
  miniAppAddSupported: null,
  embeddedEoaAddress: null,
  zoraProviderAddresses: [],
  canonicalZoraCswAddress: null,
  canonicalZoraCswUnresolvedReason: null,
  mappingStatus: 'NEEDS_PRIVY_AUTH',
  mappingError: null,
  // CSW linking status
  cswLinked: false,
  cswLinkBusy: false,
  cswLinkError: null,
  // CSW ERC-1271 ownership proof
  cswProofVerified: false,
  cswProofBusy: false,
  cswProofError: null,
  waitlistPosition: null,
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v)
}

function safeJsonParse<T = unknown>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeAddress(v: string): string {
  return v.trim()
}

function isValidEvmAddress(v: string): boolean {
  return EVM_RE.test(v)
}

function isValidSolanaAddress(v: string): boolean {
  const s = String(v || '').trim()
  if (!s) return false
  // Base58-ish, 32–44 chars (covers most standard pubkeys)
  if (s.length < 32 || s.length > 44) return false
  return SOL_RE.test(s)
}

function isSyntheticEmail(v: string): boolean {
  return v.endsWith('@noemail.4626.fun') || v.endsWith('@wallet.4626.fun')
}

function buildSyntheticEmail(primaryWallet: string | null): string {
  const wallet = typeof primaryWallet === 'string' ? primaryWallet.trim().toLowerCase() : ''
  if (isValidEvmAddress(wallet)) {
    return `${wallet.replace(/^0x/, '')}@wallet.4626.fun`
  }
  return `wallet-${Date.now().toString(36)}@wallet.4626.fun`
}

function formatPrivyConnectError(code: string): string {
  const c = code.trim().toLowerCase()
  if (!c) return 'Wallet connect failed.'
  // Privy OAuth linkage failure (e.g. X already linked to another Privy user).
  if (c.includes('already been linked to another user') || c.includes('linked to another user')) {
    return 'Authentication failed: This account has already been linked to another user.'
  }
  if (c.includes('user_exited') || c.includes('user_rejected')) return 'Connection cancelled.'
  if (c.includes('client_request_timeout') || c.includes('timeout')) return 'Wallet connection timed out. Try again.'
  if (c.includes('disallowed_login_method')) {
    return "Wallet sign-in is unavailable. Try another way."
  }
  if (c.includes('unsupported_chain_id')) return 'Unsupported network. Switch to Base and try again.'
  if (c.includes('generic_connect_wallet_error') || c.includes('unknown_connect_wallet_error')) {
    return 'Wallet connect failed. Try another wallet.'
  }
  return `Wallet connect failed (${code}).`
}

function extractPrivyWalletAddress(user: any, walletsOverride?: any[]): string | null {
  const wallets = Array.isArray(walletsOverride) ? walletsOverride : Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const all = [...primaryWallet, ...wallets]

  const normalizeType = (w: any) =>
    String(w?.wallet_client_type || w?.walletClientType || w?.connector_type || w?.connectorType || '').toLowerCase()
  const isSmartOrEmbedded = (w: any) => {
    const t = normalizeType(w)
    return t.includes('smart') || t === 'base_account' || t === 'privy'
  }

  // Prefer external EOAs for Zora profile lookup.
  for (const w of all) {
    const addr = typeof w?.address === 'string' ? w.address : null
    if (!addr || !isValidEvmAddress(addr)) continue
    if (!isSmartOrEmbedded(w)) return addr
  }

  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  for (const a of linked) {
    const addr = typeof a?.address === 'string' ? a.address : null
    if (addr && isValidEvmAddress(addr)) return addr
  }

  // Fallback: smart/embedded wallet if it's the only option.
  for (const w of all) {
    const addr = typeof w?.address === 'string' ? w.address : null
    if (addr && isValidEvmAddress(addr)) return addr
  }

  return null
}

function extractPrivySolanaAddress(user: any, walletsOverride?: any[]): string | null {
  const wallets = Array.isArray(walletsOverride) ? walletsOverride : Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const all = [...primaryWallet, ...wallets]
  for (const w of all) {
    const chainType = String(w?.chain_type || w?.chainType || '').toLowerCase()
    const addr = typeof w?.address === 'string' ? w.address : null
    if (addr && chainType.includes('solana') && isValidSolanaAddress(addr)) return addr
  }
  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  for (const a of linked) {
    const t = String(a?.type || '').toLowerCase()
    const chainType = String(a?.chain_type || a?.chainType || '').toLowerCase()
    const addr = typeof a?.address === 'string' ? a.address : null
    if (!addr) continue
    if (t.includes('solana') || chainType.includes('solana')) {
      if (isValidSolanaAddress(addr)) return addr
    }
  }
  return null
}

function hasPrivyLinkedWallet(user: any, walletsOverride?: any[]): boolean {
  const wallets = Array.isArray(walletsOverride) ? walletsOverride : Array.isArray(user?.wallets) ? user.wallets : []
  const primaryWallet = user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []
  const all = [...primaryWallet, ...wallets]
  if (all.some((w) => typeof w?.address === 'string')) return true
  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  return linked.some((a: any) => {
    const t = String(a?.type || '').toLowerCase()
    const addr = typeof a?.address === 'string' ? a.address : ''
    return t.includes('wallet') || isValidEvmAddress(addr) || isValidSolanaAddress(addr)
  })
}

function getPrivyWalletMissingMessage(user: any, walletsOverride?: any[]): string {
  const linked = Array.isArray(user?.linked_accounts) ? user.linked_accounts : Array.isArray(user?.linkedAccounts) ? user.linkedAccounts : []
  const hasWallet = hasPrivyLinkedWallet(user, walletsOverride)
  const hasNonWalletAccount = linked.some((a: any) => {
    const t = String(a?.type || '').toLowerCase()
    return Boolean(t) && !t.includes('wallet')
  })
  if (hasWallet) return 'Connect Base Account to verify.'
  if (hasNonWalletAccount) {
    return "Wallet sign-in is unavailable. Try another way."
  }
  return "Wallet sign-in is unavailable. Try another way."
}

type FlowAction =
  | { type: 'reset' }
  | { type: 'select_persona'; persona: Persona }
  | { type: 'submit_success'; doneEmail: string | null }
  | { type: 'csw_complete' }
  | { type: 'set_email'; email: string }
  | { type: 'set_email_opt_out'; emailOptOut: boolean }
  | { type: 'set_done_email'; doneEmail: string | null }
  | { type: 'set_busy'; busy: boolean }
  | { type: 'set_error'; error: string | null }
  | { type: 'set_contact_preference'; contactPreference: ContactPreference }

function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'reset':
      return initialFlowState
    case 'select_persona': {
      // Simplified flow - persona is pre-set to 'creator'
      return state
    }
    case 'submit_success':
      if (state.step === 'done') return state
      return { ...state, step: 'done', doneEmail: action.doneEmail }
    case 'csw_complete':
      // Legacy - not used in simplified flow
      return state
    case 'set_email':
      return { ...state, email: action.email }
    case 'set_email_opt_out':
      return { ...state, emailOptOut: action.emailOptOut }
    case 'set_done_email':
      return { ...state, doneEmail: action.doneEmail }
    case 'set_busy':
      return { ...state, busy: action.busy }
    case 'set_error':
      return { ...state, error: action.error }
    case 'set_contact_preference':
      return { ...state, contactPreference: action.contactPreference }
    default:
      return state
  }
}

type VerificationAction =
  | { type: 'reset' }
  | { type: 'verify_wallet'; address: string; method: VerificationMethod | null }
  | { type: 'verify_solana'; address: string }
  | { type: 'clear_wallet_verifications' }
  | { type: 'privy_start' }
  | { type: 'privy_error'; error: string | null }
  | { type: 'privy_done' }
  | { type: 'base_sub_start' }
  | { type: 'base_sub_success'; address: string }
  | { type: 'base_sub_error'; error: string }

function verificationReducer(state: VerificationState, action: VerificationAction): VerificationState {
  switch (action.type) {
    case 'reset':
      return initialVerificationState
    case 'verify_wallet': {
      if (!action.address) return state
      const nextMethod =
        action.method && (!state.verifiedWalletMethod || state.verifiedWallet !== action.address)
          ? action.method
          : state.verifiedWalletMethod
      return { ...state, verifiedWallet: action.address, verifiedWalletMethod: nextMethod }
    }
    case 'verify_solana':
      if (!action.address) return state
      return { ...state, verifiedSolana: action.address }
    case 'clear_wallet_verifications':
      return {
        ...state,
        verifiedWallet: null,
        verifiedWalletMethod: null,
        verifiedSolana: null,
        baseSubAccount: null,
        baseSubAccountBusy: false,
        baseSubAccountError: null,
      }
    case 'privy_start':
      return { ...state, privyVerifyBusy: true, privyVerifyError: null }
    case 'privy_error':
      return { ...state, privyVerifyBusy: false, privyVerifyError: action.error }
    case 'privy_done':
      return { ...state, privyVerifyBusy: false, privyVerifyError: null }
    case 'base_sub_start':
      return { ...state, baseSubAccountBusy: true, baseSubAccountError: null }
    case 'base_sub_success':
      return { ...state, baseSubAccountBusy: false, baseSubAccountError: null, baseSubAccount: action.address }
    case 'base_sub_error':
      return { ...state, baseSubAccountBusy: false, baseSubAccountError: action.error }
    default:
      return state
  }
}

function waitlistReducer(state: WaitlistState, action: WaitlistAction): WaitlistState {
  if (action.type === 'reset') return initialWaitlistState
  if (action.type === 'setActions') return { ...state, actionsDone: action.actions }
  if (action.type === 'markAction') {
    if (state.actionsDone[action.key]) return state
    return { ...state, actionsDone: { ...state.actionsDone, [action.key]: true } }
  }
  if (action.type === 'patch') return { ...state, ...action.patch }
  return state
}

export function WaitlistFlow(props: { variant?: Variant; sectionId?: string }) {
  const variant: Variant = props.variant ?? 'page'
  const sectionId = props.sectionId ?? 'waitlist'
  const prefersReducedMotion = useReducedMotion()

  const location = useLocation()
  const navigate = useNavigate()
  const [flow, dispatchFlow] = useReducer(flowReducer, initialFlowState)
  const [verification, dispatchVerification] = useReducer(verificationReducer, initialVerificationState)
  const [waitlist, dispatchWaitlist] = useReducer(waitlistReducer, initialWaitlistState)
  const creatorCoinForWalletRef = useRef<string | null>(null)
  const claimCoinForWalletRef = useRef<string | null>(null)

  const refreshPositionInFlightRef = useRef<Promise<void> | null>(null)
  const refreshPositionAbortRef = useRef<AbortController | null>(null)

  const appUrl = useMemo(() => getAppBaseUrl(), [])
  const { apiFetch } = useWaitlistApi(appUrl)
  const { address: connectedAddressRaw } = useAccount()
  const publicClient = usePublicClient({ chainId: base.id })
  const { signMessageAsync } = useSignMessage()
  const siwe = useSiweAuth()
  const farcasterAuth = useFarcasterAuth()
  const miniApp = useMiniAppContext()

  const patchWaitlist = useCallback((patch: Partial<WaitlistState>) => {
    dispatchWaitlist({ type: 'patch', patch })
  }, [])

  const submitSuccess = useCallback((doneEmail: string | null) => dispatchFlow({ type: 'submit_success', doneEmail }), [])
  const setEmail = useCallback((email: string) => dispatchFlow({ type: 'set_email', email }), [])
  const setEmailOptOut = useCallback(
    (emailOptOutNext: boolean) => dispatchFlow({ type: 'set_email_opt_out', emailOptOut: emailOptOutNext }),
    [],
  )
  const setBusy = useCallback((busy: boolean) => dispatchFlow({ type: 'set_busy', busy }), [])
  const setError = useCallback((error: string | null) => dispatchFlow({ type: 'set_error', error }), [])
  const setContactPreference = useCallback(
    (contactPreferenceNext: ContactPreference) =>
      dispatchFlow({ type: 'set_contact_preference', contactPreference: contactPreferenceNext }),
    [],
  )

  const verifyWallet = useCallback(
    (address: string, method: VerificationMethod | null) => dispatchVerification({ type: 'verify_wallet', address, method }),
    [],
  )
  const verifySolana = useCallback((address: string) => dispatchVerification({ type: 'verify_solana', address }), [])
  const startPrivyVerify = useCallback(() => dispatchVerification({ type: 'privy_start' }), [])
  const finishPrivyVerify = useCallback(() => dispatchVerification({ type: 'privy_done' }), [])
  const setPrivyVerifyError = useCallback(
    (error: string | null) => dispatchVerification({ type: 'privy_error', error }),
    [],
  )
  const startBaseSubAccount = useCallback(() => dispatchVerification({ type: 'base_sub_start' }), [])
  const setBaseSubAccount = useCallback(
    (address: string) => dispatchVerification({ type: 'base_sub_success', address }),
    [],
  )
  const setBaseSubAccountError = useCallback(
    (error: string) => dispatchVerification({ type: 'base_sub_error', error }),
    [],
  )
  const setActionsDone = useCallback(
    (actionsDone: Record<ActionKey, boolean>) => dispatchWaitlist({ type: 'setActions', actions: actionsDone }),
    [],
  )

  const { persona, step, email, busy, doneEmail, error: submitError, emailOptOut, contactPreference } = flow
  const {
    verifiedWallet,
    verifiedWalletMethod,
    verifiedSolana,
    privyVerifyBusy,
    privyVerifyError,
    baseSubAccount,
    baseSubAccountBusy,
  } = verification
  const {
    creatorCoin,
    creatorCoinDeclaredMissing,
    creatorCoinBusy,
    claimCoinBusy,
    claimReferralCode,
    inviteToast,
    inviteTemplateIdx,
    referralCode,
    actionsDone,
    waitlistPosition,
    embeddedEoaAddress: embeddedEoaAddressFromState,
    zoraProviderAddresses,
    canonicalZoraCswAddress,
    canonicalZoraCswUnresolvedReason,
    mappingStatus,
    mappingError,
    cswProofVerified,
    cswProofBusy,
    cswProofError,
  } = waitlist

  const borderTier = waitlistPosition?.borderTier ?? 0
  const hasUpgradedBorder = borderTier >= 1
  const siwfFid = useMemo(() => {
    const fid = typeof farcasterAuth.fid === 'number' ? farcasterAuth.fid : null
    return fid && Number.isFinite(fid) && fid > 0 ? fid : null
  }, [farcasterAuth.fid])

  const privyStatus = usePrivyClientStatus()
  const showPrivy = isPrivyClientEnabled()
  const privyHooksEnabled = showPrivy && privyStatus === 'ready'
  const {
    ready: privyReady,
    authenticated: privyAuthed,
    user: privyUser,
    linkWallet: privyLinkWallet,
    getAccessToken,
  } = useSafePrivyHook(privyHooksEnabled)
  const showPrivyReady = showPrivy && privyStatus === 'ready'
  const { connectWallet: privyConnectWallet } = useSafeConnectWalletHook({
    onSuccess: () => {
      finishPrivyVerify()
    },
    onError: (error: unknown) => {
      const code =
        error instanceof Error
          ? error.message
          : typeof (error as any)?.message === 'string'
            ? String((error as any).message)
            : String(error ?? '')
      const msg = formatPrivyConnectError(code)
      setPrivyVerifyError(msg)
    },
  }, privyHooksEnabled)
  const { login: privyLogin } = useSafeLoginHook({
    onComplete: () => {
      finishPrivyVerify()
    },
    onError: (error: unknown) => {
      const code =
        error instanceof Error
          ? error.message
          : typeof (error as any)?.message === 'string'
            ? String((error as any).message)
            : String(error ?? '')
      const msg = formatPrivyConnectError(code)
      setPrivyVerifyError(msg)
    },
  }, privyHooksEnabled)
  const { wallets: privyWallets, ready: privyWalletsReady } = useSafeWalletsHook(privyHooksEnabled)
  const { createWallet: privyCreateWallet } = useSafeCreateWalletHook(privyHooksEnabled)
  const { loginWithCrossAppAccount, linkCrossAppAccount } = useSafeCrossAppAccountsHook(privyHooksEnabled)
  const { baseAccountSdk } = useSafeBaseAccountSdkHook(privyHooksEnabled)
  const walletsReady = typeof privyWalletsReady === 'boolean' ? privyWalletsReady : true

  // Wallet type detection can vary across Privy SDK versions/contexts.
  // Mirror deploy hardening: look across multiple fields and use substring matches.
  const walletClientTypeOf = useCallback((w: any): string => {
    return String(
      w?.wallet_client_type ??
        w?.walletClientType ??
        w?.connector_type ??
        w?.connectorType ??
        w?.type ??
        '',
    )
      .trim()
      .toLowerCase()
  }, [])
  const embeddedWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return (
      ws.find((w) => {
        const t = walletClientTypeOf(w)
        return t === 'privy' || t.includes('privy') || t.includes('embedded')
      }) ?? null
    )
  }, [privyWallets, walletClientTypeOf])
  const baseAccountWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return ws.find((w) => walletClientTypeOf(w) === 'base_account') ?? null
  }, [privyWallets, walletClientTypeOf])
  
  // Detect Coinbase Smart Wallet from Privy wallets
  const coinbaseSmartWallet = useMemo(() => {
    const ws = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    return ws.find((w) => {
      const t = walletClientTypeOf(w)
      return t.includes('coinbase_smart_wallet') || t.includes('coinbase-smart-wallet')
    }) ?? null
  }, [privyWallets, walletClientTypeOf])
  const coinbaseSmartWalletAddress = useMemo(() => {
    const raw = typeof coinbaseSmartWallet?.address === 'string' ? coinbaseSmartWallet.address : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [coinbaseSmartWallet?.address])
  const embeddedWalletAddress = useMemo(() => {
    const raw = typeof embeddedWallet?.address === 'string' ? embeddedWallet.address : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [embeddedWallet?.address])
  const baseAccountAddress = useMemo(() => {
    const raw = typeof baseAccountWallet?.address === 'string' ? baseAccountWallet.address : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [baseAccountWallet?.address])
  const [embeddedWalletCreateBusy, setEmbeddedWalletCreateBusy] = useState(false)
  const [zoraLinkBusy, setZoraLinkBusy] = useState(false)
  const [canonicalResolveBusy, setCanonicalResolveBusy] = useState(false)
  const pendingEmbeddedCreateRef = useRef(false)
  const canonicalResolveAttemptKeyRef = useRef<string | null>(null)

  const zoraCrossAppAccounts = useMemo(
    () => extractZoraCrossAppAccounts(privyUser, ZORA_PRIVY_APP_ID),
    [privyUser],
  )
  const zoraAddressSet = useMemo(
    () => extractZoraProviderAddresses(zoraCrossAppAccounts),
    [zoraCrossAppAccounts],
  )
  const zoraReadOnlyLinked = zoraCrossAppAccounts.length > 0

  const createEmbeddedWallet = useCallback(async () => {
    if (embeddedWalletCreateBusy) return
    if (embeddedWalletAddress) return
    if (!privyAuthed) {
      setPrivyVerifyError('Continue with Privy before creating your wallet.')
      return
    }
    if (!walletsReady) {
      setPrivyVerifyError('Wallets are still loading. Please wait a moment and retry.')
      return
    }
    if (typeof privyCreateWallet !== 'function') {
      setPrivyVerifyError('Wallet creation is unavailable in this session. Please refresh and retry.')
      return
    }

    console.info('[waitlist][privy] embedded missing, creating...')
    pendingEmbeddedCreateRef.current = true
    setEmbeddedWalletCreateBusy(true)
    patchWaitlist({ mappingError: null })
    try {
      try {
        await privyCreateWallet({ chainType: 'ethereum' } as any)
      } catch {
        await privyCreateWallet()
      }
    } catch (e: any) {
      pendingEmbeddedCreateRef.current = false
      const msg = e?.message ? String(e.message) : 'Wallet creation failed. Please retry.'
      patchWaitlist({ mappingError: msg })
      setPrivyVerifyError(msg)
    } finally {
      setEmbeddedWalletCreateBusy(false)
    }
  }, [
    embeddedWalletAddress,
    embeddedWalletCreateBusy,
    patchWaitlist,
    privyAuthed,
    privyCreateWallet,
    walletsReady,
    setPrivyVerifyError,
  ])

  const linkZoraReadOnly = useCallback(async () => {
    if (zoraLinkBusy) return
    if (!embeddedWalletAddress) {
      patchWaitlist({ mappingError: 'Create your embedded wallet first.' })
      return
    }
    const crossAppAuthAction = selectZoraCrossAppAuthAction({
      privyAuthed,
      linkCrossAppAccount,
      loginWithCrossAppAccount,
    })
    if (!crossAppAuthAction) {
      patchWaitlist({ mappingError: 'Zora linking is unavailable in this session. Please refresh and retry.' })
      return
    }

    console.info('[waitlist][zora] linking start')
    setZoraLinkBusy(true)
    patchWaitlist({ mappingError: null })
    try {
      if (crossAppAuthAction === 'link') {
        await linkCrossAppAccount({ appId: ZORA_PRIVY_APP_ID })
      } else {
        await loginWithCrossAppAccount({ appId: ZORA_PRIVY_APP_ID })
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Zora linking was cancelled. Please retry.'
      patchWaitlist({ mappingError: msg })
      setPrivyVerifyError(msg)
    } finally {
      setZoraLinkBusy(false)
    }
  }, [
    embeddedWalletAddress,
    linkCrossAppAccount,
    loginWithCrossAppAccount,
    patchWaitlist,
    privyAuthed,
    setPrivyVerifyError,
    zoraLinkBusy,
  ])

  const ensureBaseSubAccount = useCallback(async () => {
    if (!embeddedWallet || !embeddedWalletAddress) return
    if (!baseAccountWallet || !baseAccountAddress) return
    if (baseSubAccount || baseSubAccountBusy) return

    startBaseSubAccount()
    try {
      if (typeof baseAccountWallet.switchChain === 'function') {
        try {
          await baseAccountWallet.switchChain(base.id)
        } catch {
          // ignore
        }
      }

      const provider = await baseAccountWallet.getEthereumProvider()
      if (!provider?.request) throw new Error('Base Account provider missing request()')

      const res = (await provider.request({
        method: 'wallet_getSubAccounts',
        params: [
          {
            account: baseAccountAddress,
            domain: typeof window !== 'undefined' ? window.location.origin : 'https://4626.fun',
          },
        ],
      })) as { subAccounts?: Array<{ address?: string } | null> } | null

      const existing = Array.isArray(res?.subAccounts) ? res?.subAccounts?.[0] : null
      const existingAddr = typeof (existing as any)?.address === 'string' ? String((existing as any).address) : ''
      let subAddr: string | null = isValidEvmAddress(existingAddr) ? existingAddr : null

      if (!subAddr) {
        const created = (await provider.request({
          method: 'wallet_addSubAccount',
          params: [
            {
              version: '1',
              account: {
                type: 'create',
                keys: [
                  {
                    type: 'address',
                    publicKey: embeddedWalletAddress as any,
                  },
                ],
              },
            },
          ],
        })) as { address?: string } | null
        const createdAddr = typeof created?.address === 'string' ? created.address : ''
        subAddr = isValidEvmAddress(createdAddr) ? createdAddr : null
      }

      if (!subAddr) throw new Error('Failed to create Base sub-account')
      setBaseSubAccount(subAddr)

      if (baseAccountSdk?.subAccount?.setToOwnerAccount) {
        baseAccountSdk.subAccount.setToOwnerAccount(async () => {
          const account = await toViemAccount({ wallet: embeddedWallet })
          return { account }
        })
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Base sub-account setup failed'
      setBaseSubAccountError(msg)
    }
  }, [
    baseAccountAddress,
    baseAccountSdk,
    baseAccountWallet,
    baseSubAccount,
    baseSubAccountBusy,
    embeddedWallet,
    embeddedWalletAddress,
    setBaseSubAccount,
    setBaseSubAccountError,
    startBaseSubAccount,
  ])

  const siweAuthAddress = useMemo(() => {
    const raw = typeof siwe.authAddress === 'string' ? siwe.authAddress : ''
    return isValidEvmAddress(raw) ? raw : null
  }, [siwe.authAddress])

  const { handlePrivyContinue } = useWaitlistVerification({
    persona,
    step,
    showPrivy,
    privyStatus,
    privyReady,
    privyAuthed,
    privyUser,
    privyWallets,
    privyVerifyBusy,
    privyVerifyError,
    verifiedWallet,
    verifiedSolana,
    embeddedWalletAddress,
    baseAccountAddress,
    baseSubAccount,
    baseSubAccountBusy,
    siwe: { isSignedIn: siwe.isSignedIn, authAddress: siweAuthAddress },
    verifyWallet,
    verifySolana,
    startPrivyVerify,
    finishPrivyVerify,
    setPrivyVerifyError,
    privyLinkWallet,
    privyConnectWallet,
    privyLogin,
    formatPrivyConnectError,
    extractPrivyWalletAddress,
    extractPrivySolanaAddress,
    getPrivyWalletMissingMessage,
    ensureBaseSubAccount,
  })

  useEffect(() => {
    if (step !== 'verify') return
    if (verifiedWallet) return
    const candidate = typeof farcasterAuth.session?.primaryAddress === 'string' ? farcasterAuth.session.primaryAddress : ''
    if (!isValidEvmAddress(candidate)) return
    verifyWallet(getAddress(candidate), 'siwf')
  }, [farcasterAuth.session?.primaryAddress, step, verifiedWallet, verifyWallet])

  const handleSiwfContinue = useCallback(async () => {
    const session = await farcasterAuth.signIn()
    const candidate = typeof session?.primaryAddress === 'string' ? session.primaryAddress : ''
    if (isValidEvmAddress(candidate)) {
      verifyWallet(getAddress(candidate), 'siwf')
      setPrivyVerifyError(null)
      return
    }
    const fid = typeof session?.fid === 'number' ? session.fid : null
    if (fid && fid > 0) {
      setPrivyVerifyError('Farcaster verified. Connect a wallet owner address to continue.')
      return
    }
    setPrivyVerifyError('Farcaster verification failed. Try again.')
  }, [farcasterAuth, setPrivyVerifyError, verifyWallet])

  const openInAppPrivyLogin = useCallback(async () => {
    if (privyVerifyBusy) return

    // Fallback: avoid trapping users on loading states when Privy is unavailable.
    if (!showPrivy || !showPrivyReady || !privyReady) {
      const signed = await siwe.signIn({ method: 'auto' }).catch(() => null)
      const candidate =
        (typeof signed === 'string' && signed) ||
        (typeof connectedAddressRaw === 'string' && connectedAddressRaw) ||
        (typeof siwe.authAddress === 'string' && siwe.authAddress) ||
        null
      if (candidate && isValidEvmAddress(candidate)) {
        verifyWallet(getAddress(candidate), 'siwe')
        setPrivyVerifyError(null)
        return
      }
      setPrivyVerifyError('Wallet login unavailable. Connect wallet and retry.')
      return
    }

    // Guardrail: never leave the UI stuck in a busy state (Privy can no-op in some edge cases).
    if (typeof window !== 'undefined') {
      window.setTimeout(() => finishPrivyVerify(), 12_000)
    }
    if (privyAuthed) {
      handlePrivyContinue()
      return
    }
    handlePrivyContinue()
  }, [
    connectedAddressRaw,
    finishPrivyVerify,
    handlePrivyContinue,
    privyAuthed,
    privyReady,
    privyVerifyBusy,
    showPrivy,
    showPrivyReady,
    siwe,
    setPrivyVerifyError,
    verifyWallet,
  ])

  const openPrivyLogin = useCallback(async () => {
    if (privyVerifyBusy) return
    if (!showPrivy || !showPrivyReady || !privyReady) {
      await openInAppPrivyLogin()
      return
    }

    startPrivyVerify()
    // Guardrail: never leave the UI stuck in a busy state.
    if (typeof window !== 'undefined') {
      window.setTimeout(() => finishPrivyVerify(), 12_000)
    }
    try {
      const signed = await siwe.signIn({ method: 'zora' }).catch(() => null)
      if (signed && isValidEvmAddress(signed)) {
        verifyWallet(getAddress(signed), 'privy')
        setPrivyVerifyError(null)
        finishPrivyVerify()
        return
      }
      setPrivyVerifyError('Sign-in was cancelled. Try again or choose another way.')
    } catch {
      setPrivyVerifyError("Couldn't sign in with wallet. Try another way.")
    } finally {
      finishPrivyVerify()
    }
  }, [
    finishPrivyVerify,
    openInAppPrivyLogin,
    privyReady,
    privyVerifyBusy,
    setPrivyVerifyError,
    showPrivy,
    showPrivyReady,
    siwe,
    startPrivyVerify,
    verifyWallet,
  ])

  const autoSubmitAttemptRef = useRef<string | null>(null)
  const ownershipTelemetryRef = useRef<string | null>(null)

  const emailTrimmed = useMemo(() => normalizeEmail(email), [email])
  const isEmailValid = useMemo(() => isValidEmail(emailTrimmed), [emailTrimmed])
  const emailOk = emailTrimmed.length === 0 || isEmailValid
  const connectedAddress = useMemo(
    () =>
      typeof connectedAddressRaw === 'string' && connectedAddressRaw.startsWith('0x') ? connectedAddressRaw.toLowerCase() : null,
    [connectedAddressRaw],
  )
  const effectiveAdminAddress = useMemo(() => connectedAddress ?? (siweAuthAddress ? siweAuthAddress.toLowerCase() : null), [connectedAddress, siweAuthAddress])

  // Best-effort: infer Coinbase Smart Wallet from Zora profile (payout recipient / linked wallets).
  // This is used for:
  // - showing “Smart Wallet Detected”
  // - awarding CSW points at signup when we already know the wallet
  const [zoraProfileSmartWalletAddress, setZoraProfileSmartWalletAddress] = useState<string | null>(null)
  const cswAddress = useMemo(() => {
    const raw = typeof zoraProfileSmartWalletAddress === 'string' ? zoraProfileSmartWalletAddress : ''
    return isAddress(raw) ? (getAddress(raw) as any) : null
  }, [zoraProfileSmartWalletAddress])
  const knownCanonicalCswAddress = coinbaseSmartWalletAddress
  const profileDerivedCanonicalCswAddress = cswAddress
  const effectiveCswAddress =
    canonicalZoraCswAddress || knownCanonicalCswAddress || profileDerivedCanonicalCswAddress
  const ownerInstallStatus = useMemo(
    () =>
      deriveOwnerInstallMappingStatus({
        privyAuthed: Boolean(privyAuthed),
        walletsReady: Boolean(walletsReady),
        embeddedEoaAddress: embeddedWalletAddress || embeddedEoaAddressFromState,
        embeddedWalletCreating: embeddedWalletCreateBusy,
        zoraLinked: zoraReadOnlyLinked,
        zoraLinking: zoraLinkBusy,
        canonicalZoraCswAddress,
        canonicalResolving: canonicalResolveBusy,
      }),
    [
      canonicalResolveBusy,
      canonicalZoraCswAddress,
      embeddedWalletAddress,
      embeddedEoaAddressFromState,
      embeddedWalletCreateBusy,
      privyAuthed,
      walletsReady,
      zoraLinkBusy,
      zoraReadOnlyLinked,
    ],
  )
  const ownerInstallReady = ownerInstallStatus === 'READY_FOR_OWNER_INSTALL'
  const ownerWalletsNormalized = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of creatorCoin?.ownerWallets ?? []) {
      const value = String(raw || '').trim()
      if (!isValidEvmAddress(value)) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
    return out
  }, [creatorCoin?.ownerWallets])
  const payoutRecipientNormalized = useMemo(() => {
    const raw = String(creatorCoin?.payoutRecipient || '').trim()
    return isValidEvmAddress(raw) ? raw.toLowerCase() : null
  }, [creatorCoin?.payoutRecipient])
  const ownershipEvidenceAvailable = ownerWalletsNormalized.length > 0 || Boolean(payoutRecipientNormalized)
  const verifiedWalletNormalized = useMemo(() => {
    const raw = String(verifiedWallet || '').trim()
    return isValidEvmAddress(raw) ? raw.toLowerCase() : null
  }, [verifiedWallet])
  const connectedWalletAuthorized = useMemo(() => {
    if (!verifiedWalletNormalized) {
      return Boolean(siwfFid) && (!creatorCoin?.address || creatorCoinDeclaredMissing || !ownershipEvidenceAvailable)
    }
    if (!creatorCoin?.address) return true
    if (!ownershipEvidenceAvailable) return true
    if (payoutRecipientNormalized && verifiedWalletNormalized === payoutRecipientNormalized) return true
    return ownerWalletsNormalized.includes(verifiedWalletNormalized)
  }, [
    siwfFid,
    creatorCoin?.address,
    creatorCoinDeclaredMissing,
    ownerWalletsNormalized,
    ownershipEvidenceAvailable,
    payoutRecipientNormalized,
    verifiedWalletNormalized,
  ])
  const canSubmit =
    ownerInstallReady && emailOk && (Boolean(creatorCoin?.address) || creatorCoinDeclaredMissing) && connectedWalletAuthorized
  const privyAuthedLogRef = useRef(false)
  const privyWalletReadyLogRef = useRef(false)
  const embeddedFoundLogRef = useRef<string | null>(null)
  const zoraLinkSuccessLogRef = useRef(false)
  const zoraProviderLogKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!privyAuthed) {
      privyAuthedLogRef.current = false
      return
    }
    if (privyAuthedLogRef.current) return
    privyAuthedLogRef.current = true
    console.info('[waitlist][privy] authed')
  }, [privyAuthed])

  useEffect(() => {
    if (!privyAuthed || !walletsReady) {
      privyWalletReadyLogRef.current = false
      return
    }
    if (privyWalletReadyLogRef.current) return
    privyWalletReadyLogRef.current = true
    console.info('[waitlist][privy] wallets ready')
  }, [privyAuthed, walletsReady])

  useEffect(() => {
    const normalized = embeddedWalletAddress ? embeddedWalletAddress.toLowerCase() : null
    if (!normalized) {
      embeddedFoundLogRef.current = null
      return
    }
    if (embeddedFoundLogRef.current !== normalized) {
      embeddedFoundLogRef.current = normalized
      console.info(`[waitlist][privy] embedded found ${normalized}`)
    }
    if (pendingEmbeddedCreateRef.current) {
      pendingEmbeddedCreateRef.current = false
      console.info(`[waitlist][privy] embedded created ${normalized}`)
    }
  }, [embeddedWalletAddress])

  useEffect(() => {
    if (mappingStatus !== ownerInstallStatus) {
      patchWaitlist({ mappingStatus: ownerInstallStatus })
    }
  }, [mappingStatus, ownerInstallStatus, patchWaitlist])

  useEffect(() => {
    const next = embeddedWalletAddress ? embeddedWalletAddress.toLowerCase() : null
    if (embeddedEoaAddressFromState === next) return
    patchWaitlist({ embeddedEoaAddress: next })
  }, [embeddedEoaAddressFromState, embeddedWalletAddress, patchWaitlist])

  useEffect(() => {
    const next = zoraReadOnlyLinked ? zoraAddressSet.providerAddresses : []
    const changed =
      zoraProviderAddresses.length !== next.length ||
      zoraProviderAddresses.some((value, index) => value !== next[index])
    if (changed) {
      patchWaitlist({ zoraProviderAddresses: next })
    }

    if (!zoraReadOnlyLinked) {
      zoraLinkSuccessLogRef.current = false
      zoraProviderLogKeyRef.current = null
      return
    }
    if (!zoraLinkSuccessLogRef.current) {
      zoraLinkSuccessLogRef.current = true
      console.info('[waitlist][zora] linking success')
    }
    const key = next.join(',')
    if (zoraProviderLogKeyRef.current === key) return
    zoraProviderLogKeyRef.current = key
    console.info(`[waitlist][zora] provider addresses ${JSON.stringify(next)}`)
  }, [patchWaitlist, zoraAddressSet.providerAddresses, zoraProviderAddresses, zoraReadOnlyLinked])

  useEffect(() => {
    if (zoraReadOnlyLinked && embeddedWalletAddress) return
    canonicalResolveAttemptKeyRef.current = null
    if (!canonicalZoraCswAddress && !canonicalZoraCswUnresolvedReason) return
    patchWaitlist({
      canonicalZoraCswAddress: null,
      canonicalZoraCswUnresolvedReason: null,
    })
  }, [
    canonicalZoraCswAddress,
    canonicalZoraCswUnresolvedReason,
    embeddedWalletAddress,
    patchWaitlist,
    zoraReadOnlyLinked,
  ])

  const isContractAddress = useCallback(
    async (candidate: string): Promise<boolean> => {
      if (!publicClient) return false
      try {
        const code = await publicClient.getBytecode({ address: getAddress(candidate) as any })
        return Boolean(code && code !== '0x')
      } catch {
        return false
      }
    },
    [publicClient],
  )

  const resolveCanonicalZoraCsw = useCallback(async () => {
    if (!zoraReadOnlyLinked || !embeddedWalletAddress) return
    setCanonicalResolveBusy(true)
    patchWaitlist({ mappingError: null, canonicalZoraCswUnresolvedReason: null })
    try {
      const resolved = await resolveCanonicalZoraCswCandidate({
        knownCanonicalAddress: knownCanonicalCswAddress,
        smartWalletAddresses: zoraAddressSet.smartWalletAddresses,
        providerAddresses: zoraAddressSet.providerAddresses,
        profileFallbackAddress: profileDerivedCanonicalCswAddress,
        isContractAddress: publicClient ? isContractAddress : undefined,
      })

      if (resolved) {
        patchWaitlist({
          canonicalZoraCswAddress: resolved,
          canonicalZoraCswUnresolvedReason: null,
        })
        console.info(`[waitlist][zora] canonical csw resolved ${resolved}`)
        return
      }

      const reason =
        'No canonical smart wallet found from linked Zora provider accounts. TODO: add deterministic factory derivation fallback.'
      patchWaitlist({
        canonicalZoraCswAddress: null,
        canonicalZoraCswUnresolvedReason: reason,
      })
      console.warn(`[waitlist][zora] canonical csw unresolved ${reason}`)
    } finally {
      setCanonicalResolveBusy(false)
    }
  }, [
    embeddedWalletAddress,
    isContractAddress,
    knownCanonicalCswAddress,
    patchWaitlist,
    profileDerivedCanonicalCswAddress,
    publicClient,
    zoraAddressSet.providerAddresses,
    zoraAddressSet.smartWalletAddresses,
    zoraReadOnlyLinked,
  ])

  useEffect(() => {
    if (step !== 'verify') return
    if (!privyAuthed || !walletsReady) return
    if (!embeddedWalletAddress || !zoraReadOnlyLinked) return

    const key = [
      embeddedWalletAddress.toLowerCase(),
      zoraAddressSet.providerAddresses.join(','),
      String(knownCanonicalCswAddress || '').toLowerCase(),
      String(profileDerivedCanonicalCswAddress || '').toLowerCase(),
    ].join('|')

    if (
      canonicalResolveAttemptKeyRef.current === key &&
      (Boolean(canonicalZoraCswAddress) || Boolean(canonicalZoraCswUnresolvedReason))
    ) {
      return
    }

    canonicalResolveAttemptKeyRef.current = key
    void resolveCanonicalZoraCsw()
  }, [
    canonicalZoraCswAddress,
    canonicalZoraCswUnresolvedReason,
    embeddedWalletAddress,
    knownCanonicalCswAddress,
    profileDerivedCanonicalCswAddress,
    privyAuthed,
    walletsReady,
    resolveCanonicalZoraCsw,
    step,
    zoraAddressSet.providerAddresses,
    zoraReadOnlyLinked,
  ])

  const retryCanonicalResolution = useCallback(() => {
    canonicalResolveAttemptKeyRef.current = null
    void resolveCanonicalZoraCsw()
  }, [resolveCanonicalZoraCsw])

  const ownerInstallGate = useMemo(() => {
    switch (ownerInstallStatus) {
      case 'NEEDS_PRIVY_AUTH':
        return {
          ctaLabel: 'Continue with Privy',
          helper: 'Sign in to start wallet setup.',
          onAction: openInAppPrivyLogin,
          busy: false,
        } as const
      case 'WAITING_FOR_WALLETS':
        return {
          ctaLabel: null,
          helper: 'Preparing your wallets...',
          onAction: null,
          busy: true,
        } as const
      case 'EMBEDDED_WALLET_MISSING':
        return {
          ctaLabel: 'Create wallet',
          helper: 'Create your embedded signer wallet to continue.',
          onAction: createEmbeddedWallet,
          busy: false,
        } as const
      case 'EMBEDDED_WALLET_CREATING':
        return {
          ctaLabel: null,
          helper: 'Creating embedded wallet...',
          onAction: null,
          busy: true,
        } as const
      case 'ZORA_LINK_REQUIRED':
        return {
          ctaLabel: 'Link Zora wallet (read-only)',
          helper: 'Link your Zora Global Wallet so we can map your canonical smart wallet.',
          onAction: linkZoraReadOnly,
          busy: false,
        } as const
      case 'ZORA_LINKING':
        return {
          ctaLabel: null,
          helper: 'Waiting for Zora linking...',
          onAction: null,
          busy: true,
        } as const
      case 'CANONICAL_RESOLVING':
        return {
          ctaLabel: null,
          helper: 'Resolving Zora wallet...',
          onAction: null,
          busy: true,
        } as const
      case 'CANONICAL_UNRESOLVED':
        return {
          ctaLabel: 'Retry resolve',
          helper: canonicalZoraCswUnresolvedReason || 'Unable to resolve your canonical Zora smart wallet.',
          onAction: retryCanonicalResolution,
          busy: false,
        } as const
      case 'READY_FOR_OWNER_INSTALL':
      default:
        return {
          ctaLabel: null,
          helper: 'Wallet mapping complete.',
          onAction: null,
          busy: false,
        } as const
    }
  }, [
    canonicalZoraCswUnresolvedReason,
    createEmbeddedWallet,
    linkZoraReadOnly,
    openInAppPrivyLogin,
    ownerInstallStatus,
    retryCanonicalResolution,
  ])

  useEffect(() => {
    if (!verifiedWalletNormalized) return
    trackEvent('wallet_connected', { wallet: verifiedWalletNormalized })
  }, [verifiedWalletNormalized])

  useEffect(() => {
    if (!verifiedWalletNormalized || !creatorCoin?.address || !ownershipEvidenceAvailable) return
    const key = `${verifiedWalletNormalized}:${creatorCoin.address.toLowerCase()}:${connectedWalletAuthorized ? 'pass' : 'fail'}`
    if (ownershipTelemetryRef.current === key) return
    ownershipTelemetryRef.current = key
    trackEvent(connectedWalletAuthorized ? 'ownership_check_pass' : 'ownership_check_fail', {
      wallet: verifiedWalletNormalized,
      coin: creatorCoin.address.toLowerCase(),
    })
  }, [connectedWalletAuthorized, creatorCoin?.address, ownershipEvidenceAvailable, verifiedWalletNormalized])
  const cswMismatch = useMemo(() => {
    const a = String(coinbaseSmartWalletAddress || '').trim().toLowerCase()
    const b = String(effectiveCswAddress || '').trim().toLowerCase()
    if (!a || !b) return false
    return a !== b
  }, [coinbaseSmartWalletAddress, effectiveCswAddress])
  const siweCswOwnershipAttestation = useMemo(() => {
    const claim = siwe.cswOwnership
    if (!claim || claim.verified !== true) return null
    const claimCsw = isValidEvmAddress(claim.cswAddress) ? claim.cswAddress.toLowerCase() : null
    const claimOwner = isValidEvmAddress(claim.ownerAddress) ? claim.ownerAddress.toLowerCase() : null
    if (!claimCsw || !claimOwner) return null

    const effective = effectiveCswAddress && isValidEvmAddress(effectiveCswAddress)
      ? effectiveCswAddress.toLowerCase()
      : null
    if (effective && claimCsw !== effective) return null
    if (verifiedWalletNormalized && claimOwner !== verifiedWalletNormalized) return null
    return { cswAddress: claimCsw, ownerAddress: claimOwner }
  }, [effectiveCswAddress, siwe.cswOwnership, verifiedWalletNormalized])
  // Optional CSW proof UI is noisy for general waitlist onboarding.
  // Keep disabled by default and enable only when explicitly requested.
  const cswProofUiEnabled = import.meta.env.VITE_WAITLIST_CSW_PROOF === 'true'

  const adminBypassSet = useMemo(() => {
    // Keep this in sync with `frontend/src/App.tsx` so admins can always escape the waitlist UI.
    const seed: string[] = [
      '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
      '0xd1780fc23f810b52d8cf277e54842dd8803c9361',
    ]
    const raw = String((import.meta.env.VITE_ADMIN_BYPASS_ADDRESSES as string | undefined) ?? '')
    const fromEnv = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => isValidEvmAddress(s))
    return new Set<string>([...seed, ...fromEnv].map((a) => a.toLowerCase()))
  }, [])
  const isBypassAdmin = !!effectiveAdminAddress && adminBypassSet.has(effectiveAdminAddress)

  // Check allowlist so we can show the right CTA on the DoneStep.
  const [deployAccessState, setDeployAccessState] = useState<'checking' | 'ready' | 'waitlist'>('checking')

  useEffect(() => {
    if (step !== 'done') return

    const intent = resolveDoneStepDeployAccessState({ isBypassAdmin, verifiedWallet })
    setDeployAccessState(intent.state)

    if (intent.state !== 'checking' || !intent.addressToCheck) return

    const addrToCheck = intent.addressToCheck
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8_000)

    const run = async () => {
      try {
        const res = await apiFetch(
          `/api/creator-allowlist?address=${encodeURIComponent(addrToCheck)}`,
          { method: 'GET', signal: controller.signal },
        )
        const json = (await res.json().catch(() => null)) as any
        const data = json?.success ? json?.data : null
        const mode = typeof data?.mode === 'string' ? String(data.mode) : null
        const allowed = data?.allowed === true
        const ok = isBypassAdmin || mode === 'disabled' || allowed
        if (!cancelled) setDeployAccessState(ok ? 'ready' : 'waitlist')
      } catch {
        if (!cancelled) setDeployAccessState('waitlist')
      } finally {
        clearTimeout(timeoutId)
      }
    }
    void run()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [apiFetch, isBypassAdmin, step, verifiedWallet])

  const deployPath = '/deploy?from=waitlist&autologin=1&auth=wallet'
  const deployUrl = useMemo(() => `${getAppBaseUrl()}${deployPath}`, [])
  const [deployHandoffBusy, setDeployHandoffBusy] = useState(false)

  const handleContinueToDeploy = useCallback(async () => {
    setDeployHandoffBusy(true)
    try {
      trackEvent('deploy_cta_clicked', { source: 'waitlist_done' })
      // Best effort: establish an app session on the current origin before redirect.
      if (!siwe.isSignedIn && privyAuthed && typeof getAccessToken === 'function') {
        const token = await getAccessToken().catch(() => null)
        if (token) {
          await siwe.signInWithPrivyToken(token).catch(() => null)
        }
      }
      // Wallet-first fallback: if Privy handoff did not establish session, run SIWE directly.
      if (!siwe.isSignedIn) {
        const signed = await siwe.signIn({ method: 'auto' }).catch(() => null)
        if (!signed) {
          patchWaitlist({ inviteToast: 'Sign in with your wallet first, then enter the app.' })
          // Throw so the DoneStep can exit-cancel and re-render the CTA.
          throw new Error('waitlist_deploy_handoff_signin_required')
        }
      }
      if (deployUrl.startsWith('http')) {
        let target = deployUrl
        try {
          const parsed = new URL(deployUrl)
          // Cross-origin handoff: copy SIWE bearer token via hash so app origin can restore session.
          if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) {
            const token = sessionStorage.getItem(SESSION_TOKEN_KEY)?.trim()
            if (token) {
              const hashParams = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash)
              hashParams.set(HANDOFF_HASH_KEY, token)
              parsed.hash = hashParams.toString()
              target = parsed.toString()
            }
          }
        } catch {
          // Keep original URL if parsing fails.
        }
        window.location.href = target
      } else {
        navigate(deployPath)
      }
    } finally {
      setDeployHandoffBusy(false)
    }
  }, [deployPath, deployUrl, getAccessToken, navigate, patchWaitlist, privyAuthed, siwe])

  const primaryCta = useMemo(() => {
    if (deployAccessState !== 'ready') return null
    return {
      label: 'Enter App',
      href: deployUrl,
      onClick: handleContinueToDeploy,
      disabled: deployHandoffBusy,
      busy: deployHandoffBusy,
      busyLabel: 'Entering App…',
    }
  }, [deployAccessState, deployHandoffBusy, handleContinueToDeploy, deployUrl])

  // Simplified flow: verify → done (2 steps)

  // Minimal flow: if Creator Coin lookup completes with no match, auto-allow joining.
  useEffect(() => {
    if (step !== 'verify') return
    if (!verifiedWallet) return
    if (creatorCoinBusy) return
    if (creatorCoin?.address) return
    if (creatorCoinDeclaredMissing) return
    patchWaitlist({ creatorCoinDeclaredMissing: true })
  }, [creatorCoin?.address, creatorCoinBusy, creatorCoinDeclaredMissing, patchWaitlist, step, verifiedWallet])

  // One-tap UX: once wallet + ownership checks are satisfied, submit automatically.
  // Keep a one-shot guard so transient API failures do not trigger endless retries.
  useEffect(() => {
    const verificationSubject =
      verifiedWallet && isValidEvmAddress(verifiedWallet)
        ? verifiedWallet.toLowerCase()
        : siwfFid
          ? `fid:${siwfFid}`
          : null
    if (step !== 'verify' || !verificationSubject) {
      autoSubmitAttemptRef.current = null
      return
    }
    if (busy) return
    if (!canSubmit) return
    const creatorKey = creatorCoin?.address
      ? creatorCoin.address.toLowerCase()
      : creatorCoinDeclaredMissing
        ? 'missing'
        : 'pending'
    const attemptKey = `${verificationSubject}:${creatorKey}`
    if (autoSubmitAttemptRef.current === attemptKey) return
    autoSubmitAttemptRef.current = attemptKey
    void submitWaitlist()
    // submitWaitlist is intentionally omitted to avoid re-firing on identity changes each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, canSubmit, creatorCoin?.address, creatorCoinDeclaredMissing, siwfFid, step, verifiedWallet])

  // Auto-fill email from Privy user when authenticated
  useEffect(() => {
    if (!privyAuthed || !privyUser) return
    if (step !== 'verify') return

    // Extract email from Privy user
    const privyEmail = privyUser.email?.address || null
    if (privyEmail && isValidEmail(privyEmail)) {
      setEmail(privyEmail)
      setEmailOptOut(false)
      setContactPreference('email')
    }

  }, [privyAuthed, privyUser, step, setEmail, setEmailOptOut, setContactPreference])

  const refreshPosition = useCallback(
    async (emailForSync: string) => {
      if (!emailForSync) return
      if (refreshPositionInFlightRef.current) return refreshPositionInFlightRef.current

      const controller = new AbortController()
      refreshPositionAbortRef.current = controller
      const run = (async () => {
        try {
          const res = await apiFetch(`/api/waitlist/position?email=${encodeURIComponent(emailForSync)}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          })
          const json = (await res.json().catch(() => null)) as any
          const data = json?.success ? json?.data : null
          if (res.ok && data) {
            patchWaitlist({
              waitlistPosition: {
                borderTier: typeof data?.borderTier === 'number' ? data.borderTier : 0,
                points: {
                  total: typeof data?.points?.total === 'number' ? data.points.total : 0,
                  invite: typeof data?.points?.invite === 'number' ? data.points.invite : 0,
                  signup: typeof data?.points?.signup === 'number' ? data.points.signup : 0,
                  tasks: typeof data?.points?.tasks === 'number' ? data.points.tasks : 0,
                  csw: typeof data?.points?.csw === 'number' ? data.points.csw : 0,
                  social: typeof data?.points?.social === 'number' ? data.points.social : 0,
                  bonus: typeof data?.points?.bonus === 'number' ? data.points.bonus : 0,
                },
                rank: {
                  invite: typeof data?.rank?.invite === 'number' ? data.rank.invite : null,
                  total: typeof data?.rank?.total === 'number' ? data.rank.total : null,
                },
                totalCount: typeof data?.totalCount === 'number' ? data.totalCount : 0,
                totalAheadInvite: typeof data?.totalAheadInvite === 'number' ? data.totalAheadInvite : null,
                percentileInvite: typeof data?.percentileInvite === 'number' ? data.percentileInvite : null,
                referrals: {
                  qualifiedCount: typeof data?.referrals?.qualifiedCount === 'number' ? data.referrals.qualifiedCount : 0,
                  pendingCount: typeof data?.referrals?.pendingCount === 'number' ? data.referrals.pendingCount : 0,
                  pendingCountCapped:
                    typeof data?.referrals?.pendingCountCapped === 'number' ? data.referrals.pendingCountCapped : 0,
                  pendingCap: typeof data?.referrals?.pendingCap === 'number' ? data.referrals.pendingCap : 10,
                },
              },
            })
          }
        } catch {
          // ignore
        } finally {
          refreshPositionInFlightRef.current = null
          refreshPositionAbortRef.current = null
        }
      })()

      refreshPositionInFlightRef.current = run
      return run
    },
    [apiFetch, patchWaitlist],
  )

  useEffect(() => {
    return () => {
      refreshPositionAbortRef.current?.abort()
    }
  }, [])

  const actionStorageKey = useMemo(
    () => (referralCode ? `cv_waitlist_actions_${referralCode}` : 'cv_waitlist_actions'),
    [referralCode],
  )
  const actionsDoneRef = useRef(actionsDone)
  useEffect(() => {
    actionsDoneRef.current = actionsDone
  }, [actionsDone])
  const markAction = useCallback(
    (action: ActionKey) => {
      const current = actionsDoneRef.current
      if (current[action]) return
      const next = { ...current, [action]: true }
      actionsDoneRef.current = next
      dispatchWaitlist({ type: 'markAction', key: action })
      try {
        localStorage.setItem(actionStorageKey, JSON.stringify(next))
      } catch {
        // ignore
      }
      // Best-effort: sync task completion to server points ledger (idempotent).
      // We key by email so all waitlist users can participate (not just wallet-auth users).
      if (doneEmail) {
        void (async () => {
          try {
            await apiFetch('/api/waitlist/task-claim', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ email: doneEmail, taskKey: action }),
            })
            await refreshPosition(doneEmail)
          } catch {
            // ignore
          }
        })()
      }
    },
    [actionStorageKey, apiFetch, doneEmail, refreshPosition],
  )
  const {
    referralLink,
    handleCopyReferral,
  } = useWaitlistReferral({
    locationSearch: location.search,
    shareBaseUrl: getWaitlistReferralBaseUrl().replace(/\/+$/, ''),
    inviteTemplateIdx,
    miniAppIsMiniApp: miniApp.isMiniApp === true,
    referralCode,
    markAction: (action) => markAction(action as any),
    setInviteTemplateIdx: (next) => patchWaitlist({ inviteTemplateIdx: next }),
    setInviteToast: (toast) => patchWaitlist({ inviteToast: toast }),
    apiFetch,
  })
  const displayEmail = doneEmail && !isSyntheticEmail(doneEmail) ? doneEmail : null
  const handleCopyReferralTracked = useCallback(() => {
    trackEvent('referral_link_copied', { source: 'waitlist_done' })
    handleCopyReferral()
  }, [handleCopyReferral])

  // When the user creates a Creator Coin from the DoneStep, update local state
  // and re-trigger pre-provisioning so the backend records it.
  const handleCoinCreated = useCallback(
    (coinAddress: string, coinSymbol: string) => {
      patchWaitlist({
        creatorCoin: {
          address: coinAddress,
          symbol: coinSymbol,
          coinType: null,
          imageUrl: null,
          marketCapUsd: null,
          volume24hUsd: null,
          holders: null,
          priceUsd: null,
          payoutRecipient: null,
          ownerWallets: [],
          canonicalSmartWallet: effectiveCswAddress || null,
        },
        creatorCoinDeclaredMissing: false,
      })
    },
    [effectiveCswAddress, patchWaitlist],
  )

  function primaryWalletForSubmit(): string | null {
    const pw = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
    return pw
  }

  function solanaWalletForSubmit(): string | null {
    const sw = typeof verifiedSolana === 'string' && isValidSolanaAddress(verifiedSolana) ? verifiedSolana : null
    return sw
  }

  function baseSubAccountForSubmit(): string | null {
    const sub = typeof baseSubAccount === 'string' && isValidEvmAddress(baseSubAccount) ? baseSubAccount : null
    return sub
  }

  function buildVerifications(): VerificationClaim[] {
    const ts = new Date().toISOString()
    const out: VerificationClaim[] = []
    if (embeddedEoaAddressFromState && isValidEvmAddress(embeddedEoaAddressFromState)) {
      out.push({ method: 'privy-embedded-eoa', subject: embeddedEoaAddressFromState, timestamp: ts })
    }
    if (verifiedWallet && isValidEvmAddress(verifiedWallet)) {
      out.push({ method: verifiedWalletMethod ?? 'siwe', subject: verifiedWallet, timestamp: ts })
    }
    if (siwfFid) {
      out.push({ method: 'siwf', subject: `fid:${siwfFid}`, timestamp: ts })
    }
    if (verifiedSolana && isValidSolanaAddress(verifiedSolana)) {
      out.push({ method: 'solana', subject: verifiedSolana, timestamp: ts })
    }
    if (siweCswOwnershipAttestation) {
      out.push({ method: 'siwe-csw-owner', subject: siweCswOwnershipAttestation.cswAddress, timestamp: ts })
    }
    for (const address of zoraProviderAddresses) {
      if (!isValidEvmAddress(address)) continue
      out.push({ method: 'privy-zora-readonly', subject: address, timestamp: ts })
    }
    if (canonicalZoraCswAddress && isValidEvmAddress(canonicalZoraCswAddress)) {
      out.push({ method: 'zora-canonical-csw', subject: canonicalZoraCswAddress, timestamp: ts })
    }
    // Include CSW ERC-1271 ownership proof if verified
    if (cswProofUiEnabled && cswProofVerified && effectiveCswAddress) {
      out.push({ method: 'csw-erc1271', subject: effectiveCswAddress, timestamp: ts })
    }
    return out
  }

  async function claimCreatorCoin(coinAddress: string, source: 'auto' | 'manual') {
    if (claimCoinBusy) return
    const coin = normalizeAddress(coinAddress).toLowerCase()
    if (!isValidEvmAddress(coin)) {
      patchWaitlist({ claimCoinError: 'Enter a valid coin address.' })
      return
    }
    patchWaitlist({ claimCoinBusy: true, claimCoinError: null })
    try {
      const res = await apiFetch('/api/creator-wallets/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ coinAddress: coin }),
      })
      const text = await res.text().catch(() => '')
      const json = safeJsonParse<any>(text)
      if (!res.ok || !json || json.success !== true) {
        const msg = json && typeof json.error === 'string' ? json.error : `Claim failed (HTTP ${res.status})`
        throw new Error(msg)
      }

      if (source === 'manual') {
        try {
          const fetched = await fetchZoraCoin(coin as any)
          if (fetched) {
            const imageUrl =
              (fetched?.mediaContent?.previewImage?.medium as string | undefined) ||
              (fetched?.mediaContent?.previewImage?.small as string | undefined) ||
              null
            const asNumber = (v: any): number | null => {
              const n = Number(v)
              return Number.isFinite(n) ? n : null
            }
            patchWaitlist({
              creatorCoin: {
                address: coin,
                symbol: fetched?.symbol ? String(fetched.symbol) : null,
                coinType: fetched?.coinType ? String(fetched.coinType) : null,
                imageUrl,
                marketCapUsd: asNumber(fetched?.marketCap),
                volume24hUsd: asNumber(fetched?.volume24h),
                holders: typeof fetched?.uniqueHolders === 'number' ? fetched.uniqueHolders : null,
                priceUsd: asNumber(fetched?.tokenPrice?.priceInUsdc),
                payoutRecipient: null,
                ownerWallets: [],
                canonicalSmartWallet: null,
              },
              creatorCoinDeclaredMissing: false,
            })
          }
        } catch {
          // ignore
        }
      }

    } catch (e: any) {
      patchWaitlist({ claimCoinError: e?.message ? String(e.message) : 'Claim failed' })
    } finally {
      patchWaitlist({ claimCoinBusy: false })
    }
  }

  async function proveCswOwnership() {
    if (!cswProofUiEnabled) return
    const csw = effectiveCswAddress
    if (!csw || cswProofBusy || cswProofVerified) return
    patchWaitlist({ cswProofBusy: true, cswProofError: null })
    try {
      // Step 1: Get a challenge from the server
      const challengeRes = await apiFetch(`/api/waitlist/csw-proof?cswAddress=${encodeURIComponent(csw)}`, {
        headers: { Accept: 'application/json' },
      })
      const challengeJson = safeJsonParse<any>(await challengeRes.text().catch(() => ''))
      if (!challengeRes.ok || !challengeJson?.success || !challengeJson?.data?.message || !challengeJson?.data?.challengeToken) {
        const msg = challengeJson?.error ?? 'Failed to get ownership challenge.'
        throw new Error(typeof msg === 'string' ? msg : 'Failed to get ownership challenge.')
      }

      const { message, challengeToken } = challengeJson.data as { message: string; challengeToken: string }
      const signingAccount = verifiedWalletNormalized ?? connectedAddress
      if (!signingAccount || !isValidEvmAddress(signingAccount)) {
        throw new Error('Connect the owner wallet you want to sign with, then retry ownership proof.')
      }
      if (
        verifiedWalletNormalized &&
        connectedAddress &&
        connectedAddress !== verifiedWalletNormalized
      ) {
        throw new Error(
          'Connected signer does not match your verified wallet. Connect the same owner wallet and retry.'
        )
      }

      // Step 2: Sign the challenge message with the connected wallet.
      // The CSW contract's isValidSignature will verify this signer is an owner.
      const signature = await signMessageAsync({
        message,
        account: signingAccount as `0x${string}`,
      })

      // Step 3: Submit the signature for on-chain ERC-1271 verification
      const verifyRes = await apiFetch('/api/waitlist/csw-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ challengeToken, cswAddress: csw, signature }),
      })
      const verifyJson = safeJsonParse<any>(await verifyRes.text().catch(() => ''))
      if (!verifyRes.ok || !verifyJson?.success || !verifyJson?.data?.verified) {
        const msg = verifyJson?.error ?? 'ERC-1271 verification failed.'
        throw new Error(typeof msg === 'string' ? msg : 'ERC-1271 verification failed.')
      }

      patchWaitlist({ cswProofVerified: true, cswProofBusy: false, cswProofError: null })
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Ownership proof failed.'
      patchWaitlist({ cswProofBusy: false, cswProofError: typeof msg === 'string' ? msg : 'Ownership proof failed.' })
    }
  }

  async function submitWaitlist() {
    setError(null)
    patchWaitlist({ referralCodeTaken: false })
    setBusy(true)
    try {
      const verifications = buildVerifications()
      const hasVerificationForSubmit = verifications.length > 0
      if (persona === 'creator' && !hasVerificationForSubmit) {
        throw new Error('Verify your identity first.')
      }
      if (persona !== 'creator' && persona !== 'user') {
        throw new Error('Select Creator or User first.')
      }
      if (emailTrimmed.length > 0 && !isEmailValid && !emailOptOut) {
        throw new Error('Enter a valid email address.')
      }

      const emailForSubmit = isEmailValid ? emailTrimmed : buildSyntheticEmail(primaryWalletForSubmit())
      const storedRef = getStoredReferralCode()
      const claim =
        persona === 'creator'
          ? String(claimReferralCode || '')
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, 16)
          : ''

      const res = await apiFetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForSubmit,
          primaryWallet: primaryWalletForSubmit(),
          solanaWallet: solanaWalletForSubmit(),
          baseSubAccount: baseSubAccountForSubmit(),
          cswAddress: effectiveCswAddress || null, // CSW linked before signup
          referralCode: storedRef,
          claimReferralCode: claim.length > 0 ? claim : null,
          contactPreference: isEmailValid ? contactPreference : 'wallet',
          verifications,
          intent: {
            persona,
            hasCreatorCoin: creatorCoinBusy ? null : creatorCoinDeclaredMissing ? false : Boolean(creatorCoin?.address),
            fid: siwfFid,
          },
        }),
      })
      const text = await res.text().catch(() => '')
      const json = safeJsonParse<any>(text)
      if (res.status === 409 && json && json.code === 'REFERRAL_CODE_TAKEN') {
        patchWaitlist({
          referralCodeTaken: true,
          claimReferralCode: String(json?.suggested ?? claim ?? ''),
        })
        throw new Error('That referral code is taken. Pick another and resubmit.')
      }
      if (!res.ok || !json || json.success !== true) {
        const msg =
          json && typeof json.error === 'string'
            ? json.error
            : res.ok
              ? 'Waitlist request failed'
              : `Waitlist request failed (HTTP ${res.status})`
        throw new Error(msg)
      }
      const doneEmailValue = String(json?.data?.email || emailForSubmit)
      trackEvent('waitlist_submitted', { persona, hasCreatorCoin: Boolean(creatorCoin?.address) })
      submitSuccess(doneEmailValue)
      patchWaitlist({ referralCode: typeof json?.data?.referralCode === 'string' ? String(json.data.referralCode) : null })

      void (async () => {
        try {
          const emailForSync = doneEmailValue
          await apiFetch('/api/waitlist/profile-complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ email: emailForSync }),
          })

          await refreshPosition(emailForSync)
        } catch {
          // ignore
        }
      })()
    } catch (e: any) {
      setError(e?.message ? String(e.message) : 'Waitlist request failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (step !== 'done') return
    if (!doneEmail) return
    void refreshPosition(doneEmail)
  }, [doneEmail, refreshPosition, step])

  useEffect(() => {
    claimCoinForWalletRef.current = null
    patchWaitlist({ claimCoinError: null })
  }, [patchWaitlist, verifiedWallet])

  useEffect(() => {
    const w = typeof verifiedWallet === 'string' && isValidEvmAddress(verifiedWallet) ? verifiedWallet : null
    if (!w) {
      patchWaitlist({ creatorCoin: null, creatorCoinBusy: false, creatorCoinDeclaredMissing: false, cswProofVerified: false, cswProofBusy: false, cswProofError: null })
      creatorCoinForWalletRef.current = null
      setZoraProfileSmartWalletAddress(null)
      return
    }
    if (creatorCoinForWalletRef.current === w) return
    creatorCoinForWalletRef.current = w

    let cancelled = false
    patchWaitlist({ creatorCoinBusy: true })
    ;(async () => {
      try {
        const profile = await fetchZoraProfile(w)
        const coinAddrRaw = profile?.creatorCoin?.address ? String(profile.creatorCoin.address) : ''
        const coinAddr = isValidEvmAddress(coinAddrRaw) ? coinAddrRaw : null
        let smartWallet: string | null = null
        let payoutRecipient: string | null = null
        const ownerWalletSet = new Set<string>()
        const linkedWalletEdges = Array.isArray((profile as any)?.linkedWallets?.edges)
          ? ((profile as any).linkedWallets.edges as any[])
          : []
        const linkedWalletNodes = linkedWalletEdges
          .map((e) => (e && typeof e === 'object' ? (e as any).node : null))
          .filter((n) => n && typeof n === 'object')
        const linkedWalletTyped = linkedWalletNodes
          .map((n) => {
            const walletAddress = String((n as any).walletAddress ?? '').trim()
            const walletType = String((n as any).walletType ?? '')
              .trim()
              .toUpperCase()
            return { walletAddress, walletType }
          })
          .filter((n) => isValidEvmAddress(n.walletAddress))
        const linkedWalletCandidates = linkedWalletTyped.map((n) => n.walletAddress)
        const linkedSmartWallet = linkedWalletTyped.find((n) => n.walletType === 'SMART_WALLET')?.walletAddress ?? null
        const linkedExternalWallets = linkedWalletTyped
          .filter((n) => n.walletType === 'EXTERNAL')
          .map((n) => getAddress(n.walletAddress).toLowerCase())

        smartWallet = linkedSmartWallet

        let symbol: string | null = null
        let coinType: string | null = null
        let imageUrl: string | null = null
        let marketCapUsd: number | null = null
        let volume24hUsd: number | null = null
        let holders: number | null = null
        let priceUsd: number | null = null
        if (coinAddr) {
          try {
            const coin = await fetchZoraCoin(coinAddr as any)
            symbol = coin?.symbol ? String(coin.symbol) : null
            coinType = coin?.coinType ? String(coin.coinType) : null
            imageUrl =
              (coin?.mediaContent?.previewImage?.medium as string | undefined) ||
              (coin?.mediaContent?.previewImage?.small as string | undefined) ||
              null
            const payoutRaw = typeof coin?.payoutRecipientAddress === 'string' ? coin.payoutRecipientAddress : ''
            payoutRecipient = isValidEvmAddress(payoutRaw) ? getAddress(payoutRaw) : payoutRecipient
            const asNumber = (v: any): number | null => {
              const n = Number(v)
              return Number.isFinite(n) ? n : null
            }
            marketCapUsd = asNumber(coin?.marketCap)
            volume24hUsd = asNumber(coin?.volume24h)
            holders = typeof coin?.uniqueHolders === 'number' ? coin.uniqueHolders : null
            priceUsd = asNumber(coin?.tokenPrice?.priceInUsdc)
          } catch {
            // ignore
          }
        }

        if (coinAddr && publicClient) {
          try {
            const payoutOnchain = await (publicClient as any).readContract({
              address: getAddress(coinAddr) as any,
              abi: CREATOR_COIN_READ_ABI,
              functionName: 'payoutRecipient',
            })
            const payoutValue = typeof payoutOnchain === 'string' ? payoutOnchain : ''
            if (isValidEvmAddress(payoutValue)) payoutRecipient = getAddress(payoutValue)
          } catch {
            // ignore
          }
          try {
            const totalOwnersRaw = await (publicClient as any).readContract({
              address: getAddress(coinAddr) as any,
              abi: CREATOR_COIN_READ_ABI,
              functionName: 'totalOwners',
            })
            const totalOwners = Number(totalOwnersRaw)
            const safeCount = Number.isFinite(totalOwners) ? Math.max(0, Math.min(totalOwners, 8)) : 0
            const owners = await Promise.all(
              Array.from({ length: safeCount }, (_, i) =>
                (publicClient as any)
                  .readContract({
                    address: getAddress(coinAddr) as any,
                    abi: CREATOR_COIN_READ_ABI,
                    functionName: 'ownerAt',
                    args: [BigInt(i)],
                  })
                  .catch(() => null),
              ),
            )
            for (const owner of owners) {
              const ownerValue = typeof owner === 'string' ? owner : ''
              if (!isValidEvmAddress(ownerValue)) continue
              ownerWalletSet.add(getAddress(ownerValue).toLowerCase())
            }
          } catch {
            // ignore
          }
        }

        let canonicalSmartWallet: string | null = null
        const ownerWallets = Array.from(ownerWalletSet)

        // If coin owner reads are unavailable, fall back to Zora-linked EXTERNAL wallet(s)
        // so owner-gated waitlist flow still works for known creator EOAs.
        if (ownerWallets.length === 0 && linkedExternalWallets.length > 0) {
          for (const owner of linkedExternalWallets) ownerWalletSet.add(owner)
        }
        const normalizedOwnerWallets = Array.from(ownerWalletSet)

        // Primary source of truth: explicit SMART_WALLET from Zora profile.
        if (smartWallet && isValidEvmAddress(smartWallet)) {
          canonicalSmartWallet = getAddress(smartWallet)
        }
        // Backward-compat fallback for older profile payloads lacking walletType.
        if (!canonicalSmartWallet && linkedWalletCandidates.length > 0) {
          for (const candidate of linkedWalletCandidates) {
            try {
              const code = await publicClient?.getBytecode({ address: getAddress(candidate) as any })
              if (code && code !== '0x') {
                canonicalSmartWallet = getAddress(candidate)
                break
              }
            } catch {
              // ignore
            }
          }
        }
        // Last fallback: contract owner from on-chain owner set.
        if (!canonicalSmartWallet && publicClient && normalizedOwnerWallets.length > 0) {
          for (const owner of normalizedOwnerWallets) {
            try {
              const code = await publicClient.getBytecode({ address: getAddress(owner) as any })
              if (code && code !== '0x') {
                canonicalSmartWallet = getAddress(owner)
                break
              }
            } catch {
              // ignore
            }
          }
        }

        // Ensure candidate is contract code. If it cannot be verified, do not trust it as canonical.
        if (canonicalSmartWallet) {
          if (!publicClient) {
            canonicalSmartWallet = null
          } else {
            try {
              const code = await publicClient.getBytecode({ address: getAddress(canonicalSmartWallet) as any })
              if (!code || code === '0x') canonicalSmartWallet = null
            } catch {
              canonicalSmartWallet = null
            }
          }
        }

        if (!cancelled) {
          patchWaitlist(
            coinAddr
              ? {
                  creatorCoin: {
                    address: coinAddr,
                    symbol,
                    coinType,
                    imageUrl,
                    marketCapUsd,
                    volume24hUsd,
                    holders,
                    priceUsd,
                    payoutRecipient: payoutRecipient ? getAddress(payoutRecipient) : null,
                    ownerWallets: normalizedOwnerWallets,
                    canonicalSmartWallet,
                  },
                  creatorCoinDeclaredMissing: false,
                }
              : { creatorCoin: null },
          )
          setZoraProfileSmartWalletAddress(canonicalSmartWallet || null)
        }
      } catch {
        if (!cancelled) {
          patchWaitlist({ creatorCoin: null })
          setZoraProfileSmartWalletAddress(null)
        }
      } finally {
        if (!cancelled) patchWaitlist({ creatorCoinBusy: false })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [patchWaitlist, publicClient, verifiedWallet])

  useEffect(() => {
    if (step !== 'verify') return
    if (persona !== 'creator') return
    if (!verifiedWallet) return
    if (!siweAuthAddress || siweAuthAddress.toLowerCase() !== verifiedWallet.toLowerCase()) return
    if (!creatorCoin?.address) return
    if (claimCoinBusy) return
    const key = `${verifiedWallet.toLowerCase()}:${creatorCoin.address.toLowerCase()}`
    if (claimCoinForWalletRef.current === key) return
    claimCoinForWalletRef.current = key
    void claimCreatorCoin(creatorCoin.address, 'auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimCoinBusy, creatorCoin?.address, persona, siweAuthAddress, step, verifiedWallet])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(actionStorageKey)
      if (!raw) {
        actionsDoneRef.current = { ...EMPTY_ACTION_STATE }
        setActionsDone({ ...EMPTY_ACTION_STATE })
        return
      }
      const parsed = safeJsonParse<Partial<Record<ActionKey, boolean>>>(raw)
      const next = { ...EMPTY_ACTION_STATE, ...(parsed || {}) }
      actionsDoneRef.current = next
      setActionsDone(next)
    } catch {
      actionsDoneRef.current = { ...EMPTY_ACTION_STATE }
      setActionsDone({ ...EMPTY_ACTION_STATE })
    }
  }, [actionStorageKey, setActionsDone])

  useEffect(() => {
    if (miniApp.added !== true) return
    markAction('saveApp')
  }, [markAction, miniApp.added])

  const containerClass =
    variant === 'page'
      ? 'waitlist-page relative min-h-[100svh] flex items-center justify-center overflow-hidden px-4 sm:px-6 py-12 sm:py-16 bg-[#0a0a0b]'
      : variant === 'modal'
        ? 'waitlist-page relative min-h-0 flex items-start justify-center overflow-visible px-0 py-0 bg-transparent'
        : 'cinematic-section'

  const innerWrapClass =
    variant === 'page'
      ? 'relative z-10 w-full max-w-[440px]'
      : variant === 'modal'
        ? 'relative z-10 w-full max-w-[560px]'
        : 'max-w-3xl mx-auto px-6 py-14'

  const cardWrapClass =
    variant === 'page'
      ? `relative overflow-hidden rounded-3xl border ${
          hasUpgradedBorder ? 'border-brand-primary/25' : 'border-white/[0.06]'
        } bg-[#0d0d0f]/95 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_-24px_rgba(0,0,0,0.6)] p-6 sm:p-8`
      : variant === 'modal'
        ? 'relative overflow-hidden'
        : `relative overflow-hidden rounded-3xl border ${
            hasUpgradedBorder ? 'border-brand-primary/25' : 'border-white/[0.06]'
          } bg-[#0d0d0f]/95 backdrop-blur-xl p-6 sm:p-8`

  return (
    <section id={variant === 'embedded' ? sectionId : undefined} className={containerClass}>
      {variant === 'page' ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,82,255,0.08),transparent)]" />
      ) : null}
      <div className={innerWrapClass}>
        {variant === 'page' || variant === 'modal' ? null : (
          <div className="mb-6">
            <div className="font-doto text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.05]">
              Waitlist
            </div>
          </div>
        )}

        <motion.div className={cardWrapClass}>
          {variant !== 'modal' && (
            <div
              className={[
                'pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset',
                hasUpgradedBorder ? 'ring-brand-primary/20' : 'ring-white/4',
              ].join(' ')}
            />
          )}
          <div className="relative z-10">
          {/* Step transition: smooth layout */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {step === 'verify' ? (
                <motion.div
                  key="step:verify"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: BASE_MOTION_MS + 0.06, ease: BASE_EASE }}
                >
                  <VerifyStep
                    verifiedWallet={verifiedWallet}
                    emailValue={email}
                    isEmailValid={isEmailValid}
                    onEmailChange={setEmail}
                    showPrivy={showPrivy}
                    showPrivyReady={showPrivyReady}
                    privyReady={privyReady}
                    privyVerifyBusy={privyVerifyBusy}
                    privyVerifyError={privyVerifyError}
                    showSiwf={miniApp.isMiniApp === true && farcasterAuth.canSiwf === true}
                    siwfFid={siwfFid}
                    siwfBusy={farcasterAuth.status === 'loading'}
                    siwfError={farcasterAuth.status === 'error' ? farcasterAuth.error : null}
                    onSiwfContinue={handleSiwfContinue}
                    walletOwnershipValid={connectedWalletAuthorized}
                    ownershipEvidenceAvailable={ownershipEvidenceAvailable}
                    cswMismatch={cswMismatch}
                    creatorCoin={creatorCoin}
                    creatorCoinDeclaredMissing={creatorCoinDeclaredMissing}
                    creatorCoinBusy={creatorCoinBusy}
                    showCswProof={cswProofUiEnabled}
                    cswProofVerified={cswProofVerified}
                    cswProofBusy={cswProofBusy}
                    cswProofError={cswProofError}
                    onProveCswOwnership={proveCswOwnership}
                    busy={busy}
                    canSubmit={canSubmit}
                    simpleVerifiedMode
                    submitError={submitError}
                    mappingStatus={mappingStatus}
                    embeddedEoaAddress={embeddedEoaAddressFromState}
                    zoraProviderAddresses={zoraProviderAddresses}
                    canonicalZoraCswAddress={canonicalZoraCswAddress}
                    canonicalZoraCswUnresolvedReason={canonicalZoraCswUnresolvedReason}
                    mappingError={mappingError}
                    mappingPrimaryCtaLabel={ownerInstallGate.ctaLabel}
                    mappingPrimaryHelperText={ownerInstallGate.helper}
                    mappingPrimaryBusy={ownerInstallGate.busy}
                    onMappingPrimaryAction={ownerInstallGate.onAction ?? undefined}
                    onPrivyContinue={openInAppPrivyLogin}
                    onPrivyFallback={openPrivyLogin}
                    onSubmit={submitWaitlist}
                  />
                </motion.div>
              ) : null}

              {step === 'done' ? (
                <motion.div
                  key="step:done"
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: BASE_MOTION_MS + 0.06, ease: BASE_EASE }}
                >
                  <DoneStep
                    doneEmail={doneEmail}
                    displayEmail={displayEmail}
                    isBypassAdmin={isBypassAdmin}
                    waitlistPosition={waitlistPosition}
                    referralCode={referralCode}
                    referralLink={referralLink}
                    primaryCta={primaryCta}
                    deployAccessState={deployAccessState}
                    onCopyReferral={handleCopyReferralTracked}
                    copyToast={inviteToast}
                    creatorCoinMissing={creatorCoinDeclaredMissing && !creatorCoin?.address}
                    smartWalletAddress={effectiveCswAddress}
                    ownerAddress={connectedAddress || (siweAuthAddress ? siweAuthAddress.toLowerCase() : null)}
                    onCoinCreated={handleCoinCreated}
                    onRefreshPosition={doneEmail ? () => refreshPosition(doneEmail) : undefined}
                    creatorCoin={creatorCoin ? {
                      address: creatorCoin.address,
                      symbol: creatorCoin.symbol,
                      imageUrl: creatorCoin.imageUrl,
                    } : null}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
