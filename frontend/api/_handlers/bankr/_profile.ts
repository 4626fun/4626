import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'
import { resolveCanonicalSmartWalletAddress } from '../../../server/_lib/canonicalWalletResolver.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
import { isAdminAddress } from '../../../server/_lib/session.js'
import {
  addBankrProfileUpdateEntry,
  createOrUpdateBankrProfile,
  probeBankrProfileEligibility,
} from '../../../server/bankr/profile.js'

type ProfileAction = 'probe' | 'createOrUpdate' | 'addUpdate'

type ProfileRequestBody = {
  action?: ProfileAction
  confirmed?: boolean
  candidateTokens?: string[]
  profile?: {
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
  update?: {
    title?: string
    content?: string
  }
}

type ProfileApiResponse = {
  actorAddress: string
  actorSource: 'session' | 'siwa'
  canonicalWallet: string | null
  data: Record<string, unknown>
}

function parseQueryTokenCandidates(req: VercelRequest): string[] {
  const raw = typeof (req.query as Record<string, unknown>).tokens === 'string'
    ? String((req.query as Record<string, unknown>).tokens)
    : ''
  if (!raw) return []
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function toAction(value: unknown): ProfileAction {
  const action = typeof value === 'string' ? value.trim() : ''
  if (action === 'createOrUpdate') return 'createOrUpdate'
  if (action === 'addUpdate') return 'addUpdate'
  return 'probe'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principal = readRequestPrincipal(req)
  if (!principal) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = principal.address.toLowerCase()
  if (!isAdminAddress(principalAddress as `0x${string}`)) {
    return res.status(403).json({ success: false, error: 'Admin authorization required' } satisfies ApiEnvelope<never>)
  }

  const canonicalWallet = await resolveCanonicalSmartWalletAddress(principalAddress)

  if (req.method === 'GET') {
    const eligibility = await probeBankrProfileEligibility({
      canonicalWallet,
      signerWallet: principalAddress,
      candidateTokens: parseQueryTokenCandidates(req),
    })
    return res.status(200).json({
      success: true,
      data: {
        actorAddress: principalAddress,
        actorSource: principal.source,
        canonicalWallet,
        data: eligibility as unknown as Record<string, unknown>,
      } satisfies ProfileApiResponse,
    } satisfies ApiEnvelope<ProfileApiResponse>)
  }

  const body = (await readJsonBody<ProfileRequestBody>(req)) ?? {}
  const action = toAction(body.action)

  if (action === 'probe') {
    const eligibility = await probeBankrProfileEligibility({
      canonicalWallet,
      signerWallet: principalAddress,
      candidateTokens: Array.isArray(body.candidateTokens) ? body.candidateTokens : [],
    })
    return res.status(200).json({
      success: true,
      data: {
        actorAddress: principalAddress,
        actorSource: principal.source,
        canonicalWallet,
        data: eligibility as unknown as Record<string, unknown>,
      } satisfies ProfileApiResponse,
    } satisfies ApiEnvelope<ProfileApiResponse>)
  }

  if (body.confirmed !== true) {
    return res.status(412).json({
      success: false,
      error: 'Mutating profile actions require confirmed=true',
    } satisfies ApiEnvelope<never>)
  }

  try {
    if (action === 'createOrUpdate') {
      const profile = body.profile ?? {}
      const result = await createOrUpdateBankrProfile({
        canonicalWallet,
        signerWallet: principalAddress,
        profile,
      })
      return res.status(200).json({
        success: true,
        data: {
          actorAddress: principalAddress,
          actorSource: principal.source,
          canonicalWallet,
          data: result as unknown as Record<string, unknown>,
        } satisfies ProfileApiResponse,
      } satisfies ApiEnvelope<ProfileApiResponse>)
    }

    const title = typeof body.update?.title === 'string' ? body.update.title : ''
    const content = typeof body.update?.content === 'string' ? body.update.content : ''
    const result = await addBankrProfileUpdateEntry({
      canonicalWallet,
      signerWallet: principalAddress,
      title,
      content,
    })
    return res.status(200).json({
      success: true,
      data: {
        actorAddress: principalAddress,
        actorSource: principal.source,
        canonicalWallet,
        data: result as unknown as Record<string, unknown>,
      } satisfies ProfileApiResponse,
    } satisfies ApiEnvelope<ProfileApiResponse>)
  } catch (error: unknown) {
    const message = String((error as Error | undefined)?.message ?? 'Bankr profile action failed')
    return res.status(400).json({
      success: false,
      error: message.slice(0, 400),
    } satisfies ApiEnvelope<never>)
  }
}
