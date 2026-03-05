import { normalizePolicyAddress } from '../../src/wallet/canonicalWalletPolicy'
import {
  bankrAddProfileUpdate,
  bankrCreateProfile,
  bankrGetProfile,
  bankrUpdateProfile,
} from './client.js'
import { probeBankrCanonicalWalletMatch, type BankrCanonicalProbe } from './probe.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTokenAddress(value: unknown): string | null {
  return normalizePolicyAddress(typeof value === 'string' ? value : null)
}

function parseProfileValue(value: unknown): Record<string, unknown> | null {
  if (!isObject(value)) return null
  if (isObject(value.profile)) return value.profile
  if (typeof value.projectName === 'string' || typeof value.tokenAddress === 'string') return value
  return null
}

function parseApprovedFlag(value: unknown): boolean | null {
  if (!isObject(value)) return null
  if (typeof value.approved === 'boolean') return value.approved
  if (isObject(value.profile) && typeof value.profile.approved === 'boolean') {
    return value.profile.approved
  }
  return null
}

function runbookLines(params: {
  walletProbe: BankrCanonicalProbe
  hasProfile: boolean
  candidateTokens: string[]
}): string[] {
  const lines: string[] = []
  lines.push('1) Confirm Bankr API auth (`BANKR_API_KEY`) and run `/api/bankr/status`.')
  lines.push('2) Verify canonical wallet match is true before any write action.')
  if (params.hasProfile) {
    lines.push('3) Profile exists. Update fields or add updates, then wait for Bankr admin approval.')
    lines.push('4) Check `https://bankr.bot/agents` after approval.')
    return lines
  }
  if (params.candidateTokens.length > 0) {
    lines.push(
      `3) Attempt profile create with a candidate token (${params.candidateTokens[0]}) via POST /api/bankr/profile.`,
    )
    lines.push('4) If Bankr rejects eligibility, deploy/assign a Bankr token with canonical CSW as fee beneficiary.')
    lines.push('5) Retry profile creation and await Bankr admin approval.')
    return lines
  }
  lines.push('3) Gather candidate token addresses already deployed through Bankr (or fee-beneficiary tokens).')
  lines.push('4) Retry eligibility probe with candidate tokens.')
  lines.push('5) If none eligible, launch/redirect a Bankr token with canonical CSW as fee beneficiary.')
  return lines
}

export type BankrProfileEligibility = {
  walletProbe: BankrCanonicalProbe
  hasProfile: boolean
  profileApproved: boolean | null
  profile: Record<string, unknown> | null
  candidateTokens: string[]
  runbook: string[]
}

export async function probeBankrProfileEligibility(params: {
  canonicalWallet: string | null
  signerWallet: string | null
  candidateTokens?: string[]
}): Promise<BankrProfileEligibility> {
  const walletProbe = await probeBankrCanonicalWalletMatch({
    canonicalWallet: params.canonicalWallet,
    signerWallet: params.signerWallet,
  })

  const profileResult = await bankrGetProfile()
  const profile = profileResult.ok ? parseProfileValue(profileResult.data) : null
  const profileApproved = profileResult.ok ? parseApprovedFlag(profileResult.data) : null
  const hasProfile = Boolean(profile)

  const tokenCandidates = Array.isArray(params.candidateTokens)
    ? params.candidateTokens.map((value) => normalizeTokenAddress(value)).filter((value): value is string => Boolean(value))
    : []

  return {
    walletProbe,
    hasProfile,
    profileApproved,
    profile,
    candidateTokens: tokenCandidates,
    runbook: runbookLines({
      walletProbe,
      hasProfile,
      candidateTokens: tokenCandidates,
    }),
  }
}

export async function createOrUpdateBankrProfile(params: {
  canonicalWallet: string | null
  signerWallet: string | null
  profile: {
    projectName?: string
    description?: string
    profileImageUrl?: string
    tokenAddress?: string
    tokenChainId?: string
    tokenSymbol?: string
    tokenName?: string
    twitterUsername?: string
    teamMembers?: unknown[]
    products?: unknown[]
    revenueSources?: unknown[]
  }
}): Promise<{
  walletProbe: BankrCanonicalProbe
  mode: 'created' | 'updated'
  result: Record<string, unknown>
}> {
  const walletProbe = await probeBankrCanonicalWalletMatch({
    canonicalWallet: params.canonicalWallet,
    signerWallet: params.signerWallet,
  })
  if (!walletProbe.walletMatch) {
    throw new Error(
      `Bankr profile write blocked: ${walletProbe.reason} (expected=${walletProbe.expectedCanonical}, bankr=${walletProbe.bankrEvmWallet ?? 'n/a'})`,
    )
  }

  const existing = await bankrGetProfile()
  const existingProfile = existing.ok ? parseProfileValue(existing.data) : null

  const tokenAddress = normalizeTokenAddress(params.profile.tokenAddress)
  const payload: Record<string, unknown> = {}
  const projectName = asString(params.profile.projectName)
  const description = asString(params.profile.description)
  const profileImageUrl = asString(params.profile.profileImageUrl)
  const tokenChainId = asString(params.profile.tokenChainId)
  const tokenSymbol = asString(params.profile.tokenSymbol)
  const tokenName = asString(params.profile.tokenName)
  const twitterUsername = asString(params.profile.twitterUsername)

  if (projectName) payload.projectName = projectName
  if (description) payload.description = description
  if (profileImageUrl) payload.profileImageUrl = profileImageUrl
  if (tokenAddress) payload.tokenAddress = tokenAddress
  if (tokenChainId) payload.tokenChainId = tokenChainId
  if (tokenSymbol) payload.tokenSymbol = tokenSymbol
  if (tokenName) payload.tokenName = tokenName
  if (twitterUsername) payload.twitterUsername = twitterUsername
  if (Array.isArray(params.profile.teamMembers)) payload.teamMembers = params.profile.teamMembers
  if (Array.isArray(params.profile.products)) payload.products = params.profile.products
  if (Array.isArray(params.profile.revenueSources)) payload.revenueSources = params.profile.revenueSources

  if (existingProfile) {
    if (Object.keys(payload).length === 0) {
      throw new Error('At least one profile field is required for update')
    }
    const update = await bankrUpdateProfile(payload)
    if (!update.ok) throw new Error(update.error)
    return {
      walletProbe,
      mode: 'updated',
      result: isObject(update.data) ? update.data : {},
    }
  }

  if (!projectName) throw new Error('projectName is required to create a Bankr profile')
  if (!tokenAddress) throw new Error('tokenAddress is required to create a Bankr profile')

  const create = await bankrCreateProfile(payload)
  if (!create.ok) throw new Error(create.error)
  return {
    walletProbe,
    mode: 'created',
    result: isObject(create.data) ? create.data : {},
  }
}

export async function addBankrProfileUpdateEntry(params: {
  canonicalWallet: string | null
  signerWallet: string | null
  title: string
  content: string
}): Promise<{
  walletProbe: BankrCanonicalProbe
  result: Record<string, unknown>
}> {
  const walletProbe = await probeBankrCanonicalWalletMatch({
    canonicalWallet: params.canonicalWallet,
    signerWallet: params.signerWallet,
  })
  if (!walletProbe.walletMatch) {
    throw new Error(
      `Bankr profile update blocked: ${walletProbe.reason} (expected=${walletProbe.expectedCanonical}, bankr=${walletProbe.bankrEvmWallet ?? 'n/a'})`,
    )
  }

  const title = asString(params.title)
  const content = asString(params.content)
  if (!title) throw new Error('title is required')
  if (!content) throw new Error('content is required')

  const update = await bankrAddProfileUpdate({ title, content })
  if (!update.ok) throw new Error(update.error)
  return {
    walletProbe,
    result: isObject(update.data) ? update.data : {},
  }
}
