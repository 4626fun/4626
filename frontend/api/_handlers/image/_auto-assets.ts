import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFile } from 'node:fs/promises'
import { isAddress } from 'viem'
import sharp from 'sharp'

import { requireServerKey } from '../../../server/zora/_shared.js'
import { fetchBytes } from '../../../server/_lib/blob.js'
import { attachImageGenerationAsset, getImageGenerationProject } from '../../../server/_lib/imageProjects.js'
import { getImageApiActor, parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'

const FRAME_SVG_URL = new URL('../../../public/brand/4626v2.svg', import.meta.url)
const AUTO_ASSET_MAX_BODY_BYTES = 20_000
const AUTO_ASSET_MAX_BYTES = 10 * 1024 * 1024
const AUTO_ASSET_FETCH_TIMEOUT_MS = 8_000
const AUTO_ASSET_FETCH_MAX_REDIRECTS = 2
const AUTO_ASSET_MAX_PIXELS = 16_000_000
const AUTO_ASSET_MAX_DIMENSION = 8192
const DEFAULT_IPFS_GATEWAY = 'https://ipfs.decentralized-content.com/ipfs/'
const IPFS_GATEWAY = `${String(process.env.IPFS_GATEWAY ?? DEFAULT_IPFS_GATEWAY).trim().replace(/\/+$/, '')}/`

type HostAllowlist = {
  exactHosts: Set<string>
  suffixHosts: string[]
}

function readHostname(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    const host = parsed.hostname.trim().toLowerCase()
    return host.length > 0 ? host : null
  } catch {
    return null
  }
}

function parseAutoAssetHostAllowlist(raw: string | undefined): HostAllowlist {
  const exactHosts = new Set<string>(['arweave.net'])
  const suffixHostSet = new Set<string>([
    'zora.co',
    'zora.fyi',
    'decentralized-content.com',
    'ipfs.io',
    'w3s.link',
    'nftstorage.link',
  ])
  const gatewayHost = readHostname(IPFS_GATEWAY)
  if (gatewayHost) exactHosts.add(gatewayHost)

  const extraHosts = String(raw ?? '')
    .split(/[\s,]+/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  for (const host of extraHosts) {
    if (host.startsWith('*.')) {
      const suffix = host.slice(2)
      if (suffix) suffixHostSet.add(suffix)
      continue
    }
    if (host.startsWith('.')) {
      const suffix = host.slice(1)
      if (suffix) suffixHostSet.add(suffix)
      continue
    }
    exactHosts.add(host)
  }

  return { exactHosts, suffixHosts: [...suffixHostSet] }
}

const AUTO_ASSET_HOST_ALLOWLIST = parseAutoAssetHostAllowlist(
  process.env.IMAGE_AUTO_ASSET_ALLOWED_HOSTS,
)

function isAutoAssetHostAllowed(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (!host) return false
  if (AUTO_ASSET_HOST_ALLOWLIST.exactHosts.has(host)) return true
  return AUTO_ASSET_HOST_ALLOWLIST.suffixHosts.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  )
}

function normalizeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function ipfsToHttpUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  if (raw.startsWith('ipfs://')) {
    const path = raw.slice('ipfs://'.length).replace(/^ipfs\//i, '').replace(/^\/+/, '')
    if (!path) return null
    return `${IPFS_GATEWAY}${path}`
  }

  if (raw.startsWith('/ipfs/')) {
    const path = raw.replace(/^\/+ipfs\//i, '')
    if (!path) return null
    return `${IPFS_GATEWAY}${path}`
  }

  if (raw.startsWith('bafy') || raw.startsWith('Qm')) {
    return `${IPFS_GATEWAY}${raw}`
  }

  return null
}

function normalizeAutoAssetSourceUrl(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null

  const ipfs = ipfsToHttpUrl(raw)
  if (ipfs) return ipfs

  if (raw.startsWith('ar://')) {
    const id = raw.slice('ar://'.length).replace(/^\/+/, '')
    if (!id) return null
    return `https://arweave.net/${id}`
  }

  return normalizeHttpUrl(raw)
}

function isAllowedAutoAssetSourceUrl(value: string | null | undefined): boolean {
  const normalized = normalizeAutoAssetSourceUrl(value)
  if (!normalized) return false
  const host = readHostname(normalized)
  if (!host) return false
  return isAutoAssetHostAllowed(host)
}

function pickSafeZoraSubjectUrl(coinData: any): string | null {
  const candidates = [
    coinData?.mediaContent?.previewImage?.medium,
    coinData?.mediaContent?.previewImage?.small,
    coinData?.mediaContent?.originalUri,
  ]
  for (const candidate of candidates) {
    const normalized = normalizeAutoAssetSourceUrl(candidate)
    if (!normalized) continue
    if (!isAllowedAutoAssetSourceUrl(normalized)) continue
    return normalized
  }
  return null
}

async function isSafeSubjectImageBytes(bytes: Uint8Array): Promise<boolean> {
  if (!(bytes.length > 0 && bytes.length <= AUTO_ASSET_MAX_BYTES)) return false
  try {
    const metadata = await sharp(Buffer.from(bytes), {
      limitInputPixels: AUTO_ASSET_MAX_PIXELS,
    }).metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    if (width <= 0 || height <= 0) return false
    if (width > AUTO_ASSET_MAX_DIMENSION || height > AUTO_ASSET_MAX_DIMENSION) return false
    return width * height <= AUTO_ASSET_MAX_PIXELS
  } catch {
    return false
  }
}

type Body = {
  projectId?: string
  creatorCoinAddress?: string
  chainId?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
  const actor = getImageApiActor(req)
  if (!actor) return res.status(401).json({ success: false, error: 'Sign in required' })
  const actorAddress = actor.toLowerCase()

  let body: Body
  try {
    body = await readBody<Body>(req, { maxBytes: AUTO_ASSET_MAX_BODY_BYTES })
  } catch {
    return res.status(413).json({ success: false, error: 'Request body too large' })
  }
  const projectId = parseRequiredString(body.projectId)
  const creatorCoinAddress = parseRequiredString(body.creatorCoinAddress)
  const chainId = typeof body.chainId === 'number' ? body.chainId : 8453

  if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' })
  if (!creatorCoinAddress || !isAddress(creatorCoinAddress)) {
    return res.status(400).json({ success: false, error: 'creatorCoinAddress must be a valid EVM address' })
  }

  // Enforce project ownership before mutating assets.
  const existingProject = await getImageGenerationProject(projectId).catch(() => null)
  if (!existingProject) {
    return res.status(404).json({ success: false, error: 'Project not found' })
  }
  const projectOwner = existingProject.ownerAddress ? String(existingProject.ownerAddress).toLowerCase() : null
  if (!projectOwner || projectOwner !== actorAddress) {
    return res.status(403).json({ success: false, error: 'Not authorized for this project' })
  }

  // Idempotency: if frame + subject are already attached to this project, skip
  // the Zora fetch and the Supabase uploads. Return the existing subject blob URL
  // so the caller still has a preview image to display.
  const existingAssets = (existingProject.assets as any[]) ?? []
  const existingFrame = existingAssets.find((a) => a.role === 'frame') ?? null
  const existingSubject = existingAssets.find((a) => a.role === 'subject') ?? null
  if (existingFrame && existingSubject) {
    return res.status(200).json({
      success: true,
      data: {
        subjectAssetId: existingSubject.id,
        subjectImageUrl: existingSubject.blobUrl,
        cached: true,
      },
    })
  }

  // 4626v2.svg is a stroke-only ring (no background fill). Inject a strong
  // glow filter (stdDeviation=26, wide filter region) then pad the ring to
  // ~25 % of the 1024×1024 canvas.
  //
  // sharp silently drops .resize() when chained after .extend() in the same
  // pipeline — use three separate sharp instances to work around this.
  //
  // PAD=60 makes the ring ~50% larger than the previous 340px padding:
  //   Ring outer: ~351 px from centre (70% of canvas half-width).
  //   Glow edge (σ≈12.5 px in final canvas, 3σ=37 px): ~388 px from centre.
  //   Dark padding from .extend() starts at ~458 px from centre.
  // Radial mask: fully opaque to 84 % → ring + wide glow preserved;
  // transparent at 97 % → just past the corners, clean fade.
  const FRAME_BG = { r: 10, g: 12, b: 18, alpha: 255 }
  const svgRaw = (await readFile(FRAME_SVG_URL)).toString('utf8')
  const svgWithGlow = svgRaw
    .replace(
      '</defs>',
      `  <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="26" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`,
    )
    .replace('stroke-linecap="round"', 'stroke-linecap="round"\n    filter="url(#glow)"')
  const frameAt1024 = await sharp(Buffer.from(svgWithGlow)).resize(1024, 1024).png().toBuffer()
  const frameExtended = await sharp(frameAt1024)
    .extend({ top: 60, left: 60, right: 60, bottom: 60, background: FRAME_BG })
    .png()
    .toBuffer()
  const framePadded = await sharp(frameExtended).resize(1024, 1024).png().toBuffer()
  const radialMaskSvg = Buffer.from(
    `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><radialGradient id="m" cx="512" cy="512" r="500" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0%"  stop-color="white" stop-opacity="1"/>` +
      `<stop offset="84%" stop-color="white" stop-opacity="1"/>` +
      `<stop offset="97%" stop-color="white" stop-opacity="0"/>` +
      `</radialGradient></defs>` +
      `<rect width="1024" height="1024" fill="url(#m)"/>` +
      `</svg>`,
  )
  const frameBytes = new Uint8Array(
    await sharp(framePadded)
      .ensureAlpha()
      .composite([{ input: await sharp(radialMaskSvg).png().toBuffer(), blend: 'dest-in' }])
      .png()
      .toBuffer(),
  )

  // Resolve creator coin image URL from Zora
  let subjectUrl: string | null = null
  const zoraKey = requireServerKey()
  if (zoraKey) {
    try {
      const sdk: any = await import('@zoralabs/coins-sdk')
      sdk.setApiKey(zoraKey)
      const coinResponse = await sdk.getCoin({ address: creatorCoinAddress, chain: chainId })
      const coinData = coinResponse.data?.zora20Token
      if (coinData) {
        subjectUrl = pickSafeZoraSubjectUrl(coinData)
      }
    } catch (e) {
      console.warn('[image/auto-assets] Failed to fetch Zora coin image:', e)
    }
  }

  if (!subjectUrl) {
    return res.status(422).json({
      success: false,
      error: 'Could not resolve an allowed creator coin image URL from Zora',
    })
  }

  let subjectBytes: Uint8Array
  let subjectContentType: string | null
  try {
    const fetched = await fetchBytes(subjectUrl, {
      maxBytes: AUTO_ASSET_MAX_BYTES,
      timeoutMs: AUTO_ASSET_FETCH_TIMEOUT_MS,
      maxRedirects: AUTO_ASSET_FETCH_MAX_REDIRECTS,
      requireImageContentType: true,
    })
    subjectBytes = fetched.bytes
    subjectContentType = fetched.contentType
  } catch {
    return res.status(422).json({ success: false, error: 'Could not fetch a safe creator coin image' })
  }
  if (!(await isSafeSubjectImageBytes(subjectBytes))) {
    return res.status(422).json({ success: false, error: 'Creator coin image failed safety validation' })
  }

  const [, subjectAsset] = await Promise.all([
    attachImageGenerationAsset({
      projectId,
      role: 'frame',
      filename: '4626-frame.png',
      contentType: 'image/png',
      bytes: frameBytes,
    }),
    attachImageGenerationAsset({
      projectId,
      role: 'subject',
      filename: 'creator-coin-logo.png',
      contentType: subjectContentType ?? 'image/jpeg',
      bytes: subjectBytes,
    }),
  ])

  return res.status(200).json({
    success: true,
    data: {
      subjectAssetId: subjectAsset.id,
      subjectImageUrl: subjectUrl,
    },
  })
}

export const __testables = {
  normalizeAutoAssetSourceUrl,
  isAllowedAutoAssetSourceUrl,
  pickSafeZoraSubjectUrl,
}
