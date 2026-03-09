import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFile } from 'node:fs/promises'
import { isAddress } from 'viem'
import sharp from 'sharp'

import { requireServerKey } from '../../../server/zora/_shared.js'
import { fetchBytes } from '../../../server/_lib/blob.js'
import { attachImageGenerationAsset } from '../../../server/_lib/imageProjects.js'
import { parseRequiredString, prepareImageApiAuthenticated, readBody } from './_shared.js'

const FRAME_SVG_URL = new URL('../../../public/brand/4626v2.svg', import.meta.url)

type Body = {
  projectId?: string
  creatorCoinAddress?: string
  chainId?: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (prepareImageApiAuthenticated(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const body = await readBody<Body>(req)
  const projectId = parseRequiredString(body.projectId)
  const creatorCoinAddress = parseRequiredString(body.creatorCoinAddress)
  const chainId = typeof body.chainId === 'number' ? body.chainId : 8453

  if (!projectId) return res.status(400).json({ success: false, error: 'projectId is required' })
  if (!creatorCoinAddress || !isAddress(creatorCoinAddress)) {
    return res.status(400).json({ success: false, error: 'creatorCoinAddress must be a valid EVM address' })
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
        subjectUrl =
          coinData.mediaContent?.previewImage?.medium ??
          coinData.mediaContent?.previewImage?.small ??
          coinData.mediaContent?.originalUri ??
          null
      }
    } catch (e) {
      console.warn('[image/auto-assets] Failed to fetch Zora coin image:', e)
    }
  }

  if (!subjectUrl) {
    return res.status(422).json({ success: false, error: 'Could not resolve creator coin image from Zora' })
  }

  const { bytes: subjectBytes, contentType: subjectContentType } = await fetchBytes(subjectUrl)

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
