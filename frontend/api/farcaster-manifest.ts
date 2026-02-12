import type { VercelRequest, VercelResponse } from '@vercel/node'
import fs from 'node:fs'
import path from 'node:path'

declare const process: { env: Record<string, string | undefined>; cwd: () => string }

type AccountAssociation = {
  header: string
  payload: string
  signature: string
}

type Manifest = {
  accountAssociation: AccountAssociation
  miniapp: Record<string, unknown>
  [key: string]: unknown
}

/** Account association for 4626.fun (marketing/waitlist). */
const ACCOUNT_ASSOCIATION_4626: AccountAssociation = {
  header: 'eyJmaWQiOjIyNzQ3MzgsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg2MkJGM0Q5NzNlMEIyNTA4Y0U2NUI2NDcyNzRiMDFFZDQzNzU5MjNhIn0',
  payload: 'eyJkb21haW4iOiI0NjI2LmZ1biJ9',
  signature: 'a0dYBtBbC+TI4CYnngVRPwZ7TZpI+8Mply+Px4FkyJs/pe9H30Vva1MXTLeGEz7k+wXSDeAEkZ0Msa25dK9NIhs=',
}

/** Account association for app.4626.fun (app). */
const ACCOUNT_ASSOCIATION_APP: AccountAssociation = {
  header: 'eyJmaWQiOjIyNzQ3MzgsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg2MkJGM0Q5NzNlMEIyNTA4Y0U2NUI2NDcyNzRiMDFFZDQzNzU5MjNhIn0',
  payload: 'eyJkb21haW4iOiJhcHAuNDYyNi5mdW4ifQ',
  signature: 'rjz1zn/lUwa6EZcgGY95i2Wmu1CGQTG2wx0YFvPc12EE6rrDhUleWt4ZyJQNLwcWG5GiGLJQ4izJPLWJQm8aTxs=',
}

const APP_ORIGIN = 'https://app.4626.fun'

const fallbackManifest: Manifest = {
  accountAssociation: ACCOUNT_ASSOCIATION_4626,
  miniapp: {
    version: '1',
    name: 'Creator Vaults',
    subtitle: 'Creator coin vaults on Base',
    description: 'Deposit creator coins into vaults, track markets, and manage creator vault launches on Base.',
    screenshotUrls: [`${APP_ORIGIN}/screenshot-1.png`, `${APP_ORIGIN}/screenshot-2.png`, `${APP_ORIGIN}/screenshot-3.png`],
    iconUrl: `${APP_ORIGIN}/miniapp-icon.png`,
    splashImageUrl: `${APP_ORIGIN}/miniapp-splash.png`,
    splashBackgroundColor: '#000000',
    homeUrl: APP_ORIGIN,
    webhookUrl: `${APP_ORIGIN}/api/webhook`,
    canonicalDomain: 'app.4626.fun',
    requiredChains: ['eip155:8453'],
    requiredCapabilities: ['actions.ready', 'actions.signIn', 'wallet.getEthereumProvider'],
    primaryCategory: 'finance',
    tags: ['creator-coins', 'vaults', 'base', 'zora'],
    heroImageUrl: `${APP_ORIGIN}/miniapp-hero.png`,
    tagline: 'Vaults for creator coins.',
    ogTitle: 'Creator Vaults',
    ogDescription: 'Deposit creator coins into vaults. Earn from trading fees. Everyone earns together.',
    ogImageUrl: `${APP_ORIGIN}/miniapp-hero.png`,
    noindex: false,
  },
}

const manifestPaths = [
  path.join(process.cwd(), 'public', '.well-known', 'farcaster.json'),
  path.join(process.cwd(), '..', 'public', '.well-known', 'farcaster.json'),
  path.join(process.cwd(), 'frontend', 'public', '.well-known', 'farcaster.json'),
]

function setNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

function parseManifest(raw: string): Manifest | null {
  try {
    const parsed = JSON.parse(raw) as Manifest
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (!parsed.accountAssociation || !parsed.miniapp) return null
    return parsed
  } catch {
    return null
  }
}

function readManifestFromEnv(): Manifest | null {
  const raw = (process.env.FARCASTER_MANIFEST_JSON || '').trim()
  if (!raw) return null
  return parseManifest(raw)
}

function readManifestFromDisk(): Manifest | null {
  for (const candidate of manifestPaths) {
    try {
      const body = fs.readFileSync(candidate, 'utf8')
      if (!body || !body.trim()) continue
      const parsed = parseManifest(body)
      if (parsed) return parsed
    } catch {
      // Ignore missing path and try the next candidate.
    }
  }
  return null
}

function getAccountAssociationOverride(): AccountAssociation | null {
  const header = (process.env.FARCASTER_ACCOUNT_ASSOCIATION_HEADER || '').trim()
  const payload = (process.env.FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD || '').trim()
  const signature = (process.env.FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE || '').trim()
  if (!header || !payload || !signature) return null
  return { header, payload, signature }
}

function applyAccountAssociationOverride(manifest: Manifest): Manifest {
  const override = getAccountAssociationOverride()
  if (!override) return manifest
  return { ...manifest, accountAssociation: override }
}

function getAccountAssociationForHost(host: string): AccountAssociation | null {
  const h = (host || '').toLowerCase().trim()
  if (h === 'app.4626.fun') return ACCOUNT_ASSOCIATION_APP
  if (h === '4626.fun' || h === 'www.4626.fun') return ACCOUNT_ASSOCIATION_4626
  return null
}

function sendManifest(res: VercelResponse, manifest: Manifest) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = 200
  res.end(JSON.stringify(manifest, null, 2))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // If configured, delegate to Farcaster Hosted Manifests.
  const hostedId = (process.env.FARCASTER_HOSTED_MANIFEST_ID || '').trim()
  if (hostedId) {
    res.statusCode = 307
    res.setHeader('Location', `https://api.farcaster.xyz/miniapps/hosted-manifest/${encodeURIComponent(hostedId)}`)
    res.end()
    return
  }

  // Fallback: serve the repo-managed manifest file (useful for local dev / early deployments).
  // This preserves existing behavior when FARCASTER_HOSTED_MANIFEST_ID is unset.
  let manifest = readManifestFromEnv() ?? readManifestFromDisk() ?? fallbackManifest
  manifest = applyAccountAssociationOverride(manifest)

  // Host-based association: when verifying app.4626.fun, Farcaster fetches from that origin.
  // Serve the matching association so verification passes.
  const hostOverride = getAccountAssociationForHost(
    (typeof req.headers?.host === 'string' ? req.headers.host : '').split(':')[0] ?? '',
  )
  if (hostOverride) {
    manifest = { ...manifest, accountAssociation: hostOverride }
  }

  sendManifest(res, manifest)
}

