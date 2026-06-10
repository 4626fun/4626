#!/usr/bin/env tsx
/**
 * Offline A/B for 1+ creator coins: fetch Zora artwork, render classic vs fuji-lut.
 *
 *   pnpm -C frontend exec tsx scripts/compare-token-icon-creators.ts
 *   pnpm -C frontend exec tsx scripts/compare-token-icon-creators.ts --explore 5
 *   pnpm -C frontend exec tsx scripts/compare-token-icon-creators.ts --creator 0x5b6741...
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveCreatorTokenArtwork } from '../server/_lib/image/creatorTokenArtwork.js'
import { renderPremiumTokenIcon as renderClassic } from '../api/_handlers/token/renderers/premium-classic/renderPremiumTokenIcon.js'
import { renderPremiumTokenIcon as renderFujiLut } from '../api/_handlers/token/renderers/fuji-lut-experimental/renderPremiumTokenIcon.js'
import { renderPremiumTokenIcon as renderPremiumV2 } from '../api/_handlers/token/renderers/premium-v2/renderPremiumTokenIcon.js'

const SIZES = [128, 256, 512] as const
const BASE_CHAIN = 8453

const DEFAULT_CREATORS: Array<{ slug: string; address: string }> = [
  { slug: 'akita', address: '0x5b674196812451b7cec024fe9d22d2c0b172fa75' },
  { slug: 'jesse', address: '0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59' },
]

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq)
    let value = trimmed.slice(eq + 1)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function slugFromExploreNode(node: {
  address?: string | null
  symbol?: string | null
  name?: string | null
  creatorProfile?: { handle?: string | null } | null
}): string {
  const handle = node.creatorProfile?.handle?.trim()
  const sym = String(node.symbol ?? node.name ?? '')
    .replace(/^\$/, '')
    .trim()
  const raw = handle || sym || String(node.address ?? '').slice(2, 10)
  return raw.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40) || 'creator'
}

async function discoverExploreCreators(
  sdk: Awaited<ReturnType<typeof loadZoraSdk>>,
  count: number,
  exclude: Set<string>,
): Promise<Array<{ slug: string; address: string }>> {
  const res = await sdk.getExploreTopVolumeCreators24h({
    query: { count: Math.min(50, count + exclude.size + 8) },
    path: { chain: 'base' },
  })
  const edges = res?.data?.exploreList?.edges ?? []
  const out: Array<{ slug: string; address: string }> = []
  for (const edge of edges) {
    const node = edge?.node
    const address = String(node?.address ?? '').toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(address) || exclude.has(address)) continue
    exclude.add(address)
    out.push({ slug: slugFromExploreNode(node ?? {}), address })
    if (out.length >= count) break
  }
  return out
}

function parseCreators(argv: string[]): {
  creators: Array<{ slug: string; address: string }>
  exploreExtra: number
} {
  const out: Array<{ slug: string; address: string }> = []
  let exploreExtra = 0
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--creator' && argv[i + 1]) {
      const address = argv[++i].toLowerCase()
      const known = DEFAULT_CREATORS.find((c) => c.address === address)
      out.push({ slug: known?.slug ?? address.slice(2, 10), address })
      continue
    }
    if (a === '--explore' && argv[i + 1]) {
      exploreExtra = Math.max(0, Number.parseInt(argv[++i], 10) || 0)
    }
  }
  return {
    creators: out.length > 0 ? out : DEFAULT_CREATORS,
    exploreExtra,
  }
}

async function fetchUrlBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

async function loadZoraSdk() {
  const key = process.env.ZORA_SERVER_API_KEY || process.env.ZORA_API_KEY
  if (!key) throw new Error('Set ZORA_SERVER_API_KEY in frontend/.env')
  const sdk = await import('@zoralabs/coins-sdk')
  sdk.setApiKey(key)
  return sdk
}

type CreatorArtworkBundle = {
  sourceImage: Uint8Array
  heroCutoutSourceImage?: Uint8Array
  symbol: string
  hasHeroCutout: boolean
}

async function fetchCreatorArtwork(
  sdk: Awaited<ReturnType<typeof loadZoraSdk>>,
  address: string,
): Promise<CreatorArtworkBundle> {
  const res = await sdk.getCoin({ address, chain: BASE_CHAIN })
  const coin = res?.data?.zora20Token
  if (!coin) throw new Error(`no zora20Token for ${address}`)
  const artwork = resolveCreatorTokenArtwork(coin)
  if (!artwork?.artworkUrl) throw new Error(`no artwork URL for ${address}`)
  const sourceImage = await fetchUrlBytes(artwork.artworkUrl)
  let heroCutoutSourceImage: Uint8Array | undefined
  if (artwork.heroCutoutArtworkUrl) {
    try {
      heroCutoutSourceImage = await fetchUrlBytes(artwork.heroCutoutArtworkUrl)
    } catch (error) {
      console.warn(`  hero cutout fetch failed: ${error instanceof Error ? error.message : error}`)
    }
  }
  const symbol =
    (typeof coin.symbol === 'string' && coin.symbol.trim()) ||
    (typeof coin.name === 'string' && coin.name.trim()) ||
    'TOKEN'
  const hasHeroCutout = !!heroCutoutSourceImage && heroCutoutSourceImage.length > 0
  return {
    sourceImage,
    heroCutoutSourceImage,
    symbol: symbol.replace(/^\$/, '').slice(0, 12),
    hasHeroCutout,
  }
}

function buildRenderParams(bundle: CreatorArtworkBundle, size: number) {
  const hasHeroCutout = bundle.hasHeroCutout
  return {
    size,
    sourceImage: bundle.sourceImage,
    heroCutoutSourceImage: bundle.heroCutoutSourceImage,
    allowHeroCutoutBreakoutForNonPixelArt: hasHeroCutout,
    // Match production: classic resolves preset from source class (AKITA = generic → standard)
    renderPreset: hasHeroCutout ? ('hero' as const) : undefined,
    symbol: bundle.symbol,
  }
}

async function renderBreakoutReference(outRoot: string): Promise<void> {
  const hermitDir = path.join(
    FRONTEND_ROOT,
    'server/_lib/alfaclub/assets',
  )
  const sourcePath = path.join(hermitDir, 'hermit-source.png')
  const cutoutPath = path.join(hermitDir, 'hermit-cutout.png')
  if (!fs.existsSync(sourcePath) || !fs.existsSync(cutoutPath)) return

  const sourceImage = new Uint8Array(await fs.promises.readFile(sourcePath))
  const heroCutoutSourceImage = new Uint8Array(await fs.promises.readFile(cutoutPath))
  const outDir = path.join(outRoot, 'breakout-reference-hermit')
  await fs.promises.mkdir(outDir, { recursive: true })
  const bundle: CreatorArtworkBundle = {
    sourceImage,
    heroCutoutSourceImage,
    symbol: 'HERMIT',
    hasHeroCutout: true,
  }
  console.log('\n[breakout-reference-hermit] bundled Hermit source+cutout (shows intended breakout)')
  for (const size of SIZES) {
    const renderParams = buildRenderParams(bundle, size)
    const classic = await renderClassic(renderParams)
    const v2 = await renderPremiumV2(renderParams)
    await fs.promises.writeFile(path.join(outDir, `classic-${size}.png`), classic)
    await fs.promises.writeFile(path.join(outDir, `premium-v2-${size}.png`), v2)
    console.log(`  @ ${size}px → classic-${size}.png, premium-v2-${size}.png`)
  }
}

async function compareOne(params: {
  slug: string
  address: string
  outRoot: string
  sdk: Awaited<ReturnType<typeof loadZoraSdk>>
}): Promise<void> {
  const { slug, address, outRoot, sdk } = params
  console.log(`\n[${slug}] ${address}`)
  const bundle = await fetchCreatorArtwork(sdk, address)
  const outDir = path.join(outRoot, slug)
  await fs.promises.mkdir(outDir, { recursive: true })
  await fs.promises.writeFile(path.join(outDir, 'input.png'), Buffer.from(bundle.sourceImage))
  if (bundle.heroCutoutSourceImage) {
    await fs.promises.writeFile(
      path.join(outDir, 'hero-cutout.png'),
      Buffer.from(bundle.heroCutoutSourceImage),
    )
  }
  console.log(
    `  symbol=${bundle.symbol} heroCutout=${bundle.hasHeroCutout ? 'yes' : 'no'} preset=${bundle.hasHeroCutout ? 'hero' : 'standard'}`,
  )

  for (const size of SIZES) {
    const renderParams = buildRenderParams(bundle, size)
    const classic = await renderClassic(renderParams)
    const v2 = await renderPremiumV2(renderParams)
    const fuji = await renderFujiLut(renderParams)
    await fs.promises.writeFile(path.join(outDir, `classic-${size}.png`), classic)
    await fs.promises.writeFile(path.join(outDir, `premium-v2-${size}.png`), v2)
    await fs.promises.writeFile(path.join(outDir, `fuji-lut-${size}.png`), fuji)
    console.log(`  @ ${size}px → classic-${size}.png, premium-v2-${size}.png, fuji-lut-${size}.png`)
  }
}

async function main() {
  loadEnvFile(path.join(FRONTEND_ROOT, '.env.local'))
  loadEnvFile(path.join(FRONTEND_ROOT, '.env'))

  const { creators: baseCreators, exploreExtra } = parseCreators(process.argv)
  const outRoot = path.resolve(FRONTEND_ROOT, 'tmp/token-icon-compare')
  const sdk = await loadZoraSdk()

  const exclude = new Set(baseCreators.map((c) => c.address))
  const exploreCreators =
    exploreExtra > 0 ? await discoverExploreCreators(sdk, exploreExtra, exclude) : []
  const creators = [...baseCreators, ...exploreCreators]

  console.log(`Output: ${outRoot}`)
  console.log(`Creators: ${creators.map((c) => c.slug).join(', ')}`)
  if (exploreCreators.length > 0) {
    console.log(`Explore add-ons: ${exploreCreators.map((c) => `${c.slug} (${c.address})`).join(', ')}`)
  }

  await renderBreakoutReference(outRoot)

  const rembgBin = process.env.REMBG_BIN ?? '/tmp/rembg-env/bin/rembg'
  if (fs.existsSync(rembgBin)) {
    process.env.REMBG_BIN = rembgBin
    console.log(`rembg: ${rembgBin} (portrait/illustration breakout via segmentation)`)
  } else {
    console.warn('rembg not found — AKITA/Jesse breakout needs REMBG_BIN or Zora heroCutoutArtworkUrl')
  }

  for (const c of creators) {
    await compareOne({ ...c, outRoot, sdk })
  }

  console.log(`\nDone. Compare premium-v2-* vs classic-* at 512px; breakout-reference-hermit/ shows target breakout.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
