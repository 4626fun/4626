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

const fallbackManifest: Manifest = {
  accountAssociation: {
    header: 'eyJmaWQiOjIxODIzMjUsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHg2NTRkZkMxNEY0QjczN2M4NjM5OWY1MTcyMGJjNTlCNTdCM2VEQjc5In0',
    payload: 'eyJkb21haW4iOiJlcmM0NjI2LmZ1biJ9',
    signature: 'lhS8ZW/t66E5BaOI+nq0tsoZp9Vf2cD1HUcb8SEI5w47VSSBG6P+yq33wTXDGD1j6HNgRYv8OR7xc9ZGdCvemRs=',
  },
  miniapp: {
    version: '1',
    name: 'Creator Vaults',
    subtitle: 'Creator coin vaults on Base',
    description: 'Deposit creator coins into vaults, track markets, and manage creator vault launches on Base.',
    screenshotUrls: ['https://4626.fun/screenshot-portrait.png'],
    iconUrl: 'https://4626.fun/miniapp-icon.png',
    splashImageUrl: 'https://4626.fun/miniapp-splash.png',
    splashBackgroundColor: '#000000',
    homeUrl: 'https://4626.fun',
    webhookUrl: 'https://4626.fun/api/webhook',
    canonicalDomain: '4626.fun',
    requiredChains: ['eip155:8453'],
    requiredCapabilities: ['actions.ready', 'actions.signIn', 'wallet.getEthereumProvider'],
    primaryCategory: 'finance',
    tags: ['creator-coins', 'vaults', 'base', 'zora'],
    heroImageUrl: 'https://4626.fun/miniapp-hero.png',
    tagline: 'Vaults for creator coins.',
    ogTitle: 'Creator Vaults',
    ogDescription: 'Deposit creator coins into vaults. Earn from trading fees. Everyone earns together.',
    ogImageUrl: 'https://4626.fun/miniapp-hero.png',
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
  const baseManifest = readManifestFromEnv() ?? readManifestFromDisk() ?? fallbackManifest
  const manifest = applyAccountAssociationOverride(baseManifest)
  sendManifest(res, manifest)
}

