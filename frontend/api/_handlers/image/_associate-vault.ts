import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

import { checkRateLimit, getClientIp, rateLimitKey, RATE_LIMITS } from '@4626/server-core'
import { getImageApiActor, parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'
import { getImageGenerationProject, setImageProjectVaultAddress } from '../../../server/_lib/image/imageProjects.js'
import { resolveCoinPartiesAndOwner } from '../../../server/_lib/onchain/coinParties.js'
import {
  resolveAuthorizedRequestPrincipal,
  isAdminAddress,
} from '@4626/server-core'



type Body = {
  projectId?: string
  vaultAddress?: string
}

const ASSOCIATE_VAULT_MAX_BODY_BYTES = 16_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  const actor = getImageApiActor(req)
  if (!actor) {
    return res.status(401).json({ success: false, error: 'Sign in required' })
  }
  const limiter = checkRateLimit(rateLimitKey('image:associate-vault', getClientIp(req)), RATE_LIMITS.agentCreative)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  let body: Body
  try {
    body = await readBody<Body>(req, { maxBytes: ASSOCIATE_VAULT_MAX_BODY_BYTES })
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' })
  }
  const projectId = parseRequiredString(body.projectId)
  const vaultAddress = parseRequiredString(body.vaultAddress)

  if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' })
  if (!vaultAddress || !isAddress(vaultAddress)) {
    return res.status(400).json({ success: false, error: 'vaultAddress must be a valid EVM address' })
  }

  const project = await getImageGenerationProject(projectId)
  if (!project || project.ownerAddress !== actor) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }
  if (project.status !== 'completed') {
    return res.status(409).json({ success: false, error: 'Project must be completed before associating a vault' })
  }

  // Ownership check: the caller must be the address that created this project.
  const creatorAddress = typeof project.creatorAddress === 'string' ? project.creatorAddress : null
  if (!creatorAddress || actor === null || creatorAddress.toLowerCase() !== actor.toLowerCase()) {
    return res.status(403).json({ success: false, error: 'Only the project creator may associate this project with a vault' })
  }

  // Integrity check: non-admin callers may only associate vaults controlled by their wallet context.
  if (!isAdminAddress(actor)) {
    const authorized = await resolveAuthorizedRequestPrincipal(req).catch(() => null)
    const actorCandidates = new Set<string>([actor.toLowerCase()])
    if (authorized?.canonicalSmartWalletAddress) actorCandidates.add(authorized.canonicalSmartWalletAddress.toLowerCase())
    if (authorized?.activeOwnerWalletAddress) actorCandidates.add(authorized.activeOwnerWalletAddress.toLowerCase())

    const vaultParties = await resolveCoinPartiesAndOwner(vaultAddress as `0x${string}`)
    const vaultOwner = typeof vaultParties.owner === 'string' ? vaultParties.owner.toLowerCase() : null
    if (!vaultOwner || !actorCandidates.has(vaultOwner)) {
      return res.status(403).json({ success: false, error: 'You do not control this vault address' })
    }
  }
  await setImageProjectVaultAddress(projectId, vaultAddress)

  return res.status(200).json({ success: true, data: { projectId, vaultAddress } })
}
