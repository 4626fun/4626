/**
 * Quick render script — generates updated token icon previews into .playwright-mcp/
 * Usage: pnpm -C frontend tsx scripts/render-preview-icons.ts
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import sharp from 'sharp'

import { renderPremiumTokenIcon } from '../api/_handlers/token/_premiumTokenIconRenderer.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.join(ROOT, '.playwright-mcp')
const execFileP = promisify(execFile)
const REMBG_BIN_CANDIDATES = [
  process.env.REMBG_BIN,
  '/tmp/rembg-env/bin/rembg',
  '/usr/local/bin/rembg',
  '/usr/bin/rembg',
  'rembg',
].filter((bin): bin is string => typeof bin === 'string' && bin.trim().length > 0)

const SUBJECTS = [
  { name: 'jessepollak', symbol: 'JESSE', original: 'creator-coin-top3-rank1-jessepollak-original.png' },
  { name: 'ugorreser',   symbol: 'UGORRE', original: 'creator-coin-top3-rank2-ugorreser-original.png' },
  { name: 'jacob',       symbol: 'JACOB',  original: 'creator-coin-top3-rank3-jacob-original.png' },
]

function buildPreviewHeroCutoutPath(subjectName: string): string {
  return path.join(OUT_DIR, `creator-coin-top3-${subjectName}-hero-cutout.png`)
}

async function runRembgCutout(sourcePng: Buffer): Promise<Buffer | null> {
  if (REMBG_BIN_CANDIDATES.length === 0) return null
  const id = randomUUID()
  const inPath = path.join(tmpdir(), `preview-rembg-in-${id}.png`)
  const outPath = path.join(tmpdir(), `preview-rembg-out-${id}.png`)
  try {
    await fsp.writeFile(inPath, sourcePng)
    for (const bin of REMBG_BIN_CANDIDATES) {
      try {
        await execFileP(bin, ['i', '-m', 'isnet-general-use', inPath, outPath], { timeout: 30_000 })
        return await fsp.readFile(outPath)
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code?: unknown }).code ?? '')
            : ''
        if (code === 'ENOENT') continue
      }
    }
    return null
  } finally {
    await Promise.allSettled([fsp.unlink(inPath), fsp.unlink(outPath)])
  }
}

async function isolateDominantSubjectComponent(cutoutPng: Buffer): Promise<Buffer | null> {
  const { data, info } = await sharp(cutoutPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height
  const channels = info.channels
  const pixelCount = width * height
  const visited = new Uint8Array(pixelCount)
  const keep = new Uint8Array(pixelCount)
  const alphaThreshold = 24
  const centerX = width * 0.5
  const centerY = height * 0.52

  let bestScore = -Infinity
  let bestPixels: number[] = []

  for (let i = 0; i < pixelCount; i += 1) {
    if (visited[i]) continue
    const alpha = data[i * channels + 3] ?? 0
    if (alpha <= alphaThreshold) continue
    const stack = [i]
    const pixels: number[] = []
    let sumX = 0
    let sumY = 0
    let touchesEdge = false
    visited[i] = 1
    while (stack.length > 0) {
      const idx = stack.pop()
      if (idx === undefined) continue
      pixels.push(idx)
      const x = idx % width
      const y = Math.floor(idx / width)
      sumX += x
      sumY += y
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesEdge = true
      }
      const neighbors = [
        idx - 1,
        idx + 1,
        idx - width,
        idx + width,
      ]
      for (const n of neighbors) {
        if (n < 0 || n >= pixelCount) continue
        const nx = n % width
        const ny = Math.floor(n / width)
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
        if (visited[n]) continue
        const na = data[n * channels + 3] ?? 0
        if (na <= alphaThreshold) continue
        visited[n] = 1
        stack.push(n)
      }
    }

    if (pixels.length < 300) continue
    const cx = sumX / pixels.length
    const cy = sumY / pixels.length
    const centerDist = Math.hypot((cx - centerX) / width, (cy - centerY) / height)
    const edgePenalty = touchesEdge ? pixels.length * 0.48 : 0
    const score = pixels.length - centerDist * pixels.length * 0.95 - edgePenalty
    if (score > bestScore) {
      bestScore = score
      bestPixels = pixels
    }
  }

  if (bestPixels.length === 0) return null
  for (const idx of bestPixels) keep[idx] = 1

  const seed = new Uint8Array(pixelCount)
  for (const idx of bestPixels) {
    const base = idx * channels
    const a = data[base + 3] ?? 0
    if (a <= 12) continue
    const r = data[base] ?? 0
    const g = data[base + 1] ?? 0
    const b = data[base + 2] ?? 0
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    const likelyForeground =
      luma < 210 ||
      chroma > 26 ||
      (a >= 235 && luma < 242)
    if (likelyForeground) {
      seed[idx] = 1
    }
  }

  let dilated = seed
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Uint8Array(dilated)
    for (let idx = 0; idx < pixelCount; idx += 1) {
      if (dilated[idx] === 0) continue
      const x = idx % width
      const y = Math.floor(idx / width)
      const neighbors = [
        idx - 1,
        idx + 1,
        idx - width,
        idx + width,
        idx - width - 1,
        idx - width + 1,
        idx + width - 1,
        idx + width + 1,
      ]
      for (const n of neighbors) {
        if (n < 0 || n >= pixelCount) continue
        const nx = n % width
        const ny = Math.floor(n / width)
        if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue
        if (keep[n]) next[n] = 1
      }
    }
    dilated = next
  }

  const out = Buffer.from(data)
  for (let i = 0; i < pixelCount; i += 1) {
    const base = i * channels
    const alpha = out[base + 3] ?? 0
    if (keep[i] && dilated[i]) {
      out[base + 3] = alpha < 46 ? 0 : alpha
    } else {
      out[base + 3] = 0
    }
  }
  return sharp(out, { raw: { width, height, channels } })
    .blur(0.34)
    .png()
    .toBuffer()
}

async function buildPreparedHeroCutout(subjectName: string, sourceImage: Uint8Array): Promise<Uint8Array | undefined> {
  const onlyFor = (process.env.TOKEN_PREVIEW_HERO_CUTOUT_SUBJECT ?? 'ugorreser').trim()
  if (onlyFor && onlyFor !== subjectName) return undefined

  const existingPath = buildPreviewHeroCutoutPath(subjectName)
  if (fs.existsSync(existingPath)) {
    const bytes = fs.readFileSync(existingPath)
    if (bytes.length > 0) {
      return new Uint8Array(bytes)
    }
  }

  const rembgCutout = await runRembgCutout(Buffer.from(sourceImage))
  if (!rembgCutout || rembgCutout.length === 0) return undefined
  const refined = await isolateDominantSubjectComponent(rembgCutout)
  if (!refined || refined.length === 0) return undefined
  fs.writeFileSync(existingPath, refined)
  return new Uint8Array(refined)
}

async function run() {
  for (const subject of SUBJECTS) {
    const originalPath = path.join(OUT_DIR, subject.original)
    let sourceImage: Uint8Array | undefined
    if (fs.existsSync(originalPath)) {
      sourceImage = new Uint8Array(fs.readFileSync(originalPath))
      console.log(`[${subject.name}] loaded source (${sourceImage.length} bytes)`)
    } else {
      console.warn(`[${subject.name}] original not found, using symbol fallback`)
    }

    let heroCutoutSourceImage: Uint8Array | undefined
    const wantsPreparedHero = process.env.TOKEN_PREVIEW_PREPARED_HERO_CUTOUT === '1'
    if (wantsPreparedHero && sourceImage && sourceImage.length > 0) {
      heroCutoutSourceImage = await buildPreparedHeroCutout(subject.name, sourceImage)
      if (heroCutoutSourceImage && heroCutoutSourceImage.length > 0) {
        console.log(`[${subject.name}] prepared hero cutout ready (${heroCutoutSourceImage.length} bytes)`)
      } else {
        console.warn(`[${subject.name}] prepared hero cutout unavailable`)
      }
    }

    const png = await renderPremiumTokenIcon({
      size: 1024,
      sourceImage,
      heroCutoutSourceImage,
      symbol: subject.symbol,
    })

    const outName = `creator-coin-top3-rank${SUBJECTS.indexOf(subject) + 1}-${subject.name}-after.png`
    const outPath = path.join(OUT_DIR, outName)
    fs.writeFileSync(outPath, png)
    console.log(`[${subject.name}] wrote ${outPath}`)
  }
}

run().catch(err => { console.error(err); process.exit(1) })
