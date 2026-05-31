import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { parse3DL, parseCube, type ParsedLut3d } from './lut3dParse.js'

export type { ParsedLut3d } from './lut3dParse.js'
export { parse3DL, parseCube } from './lut3dParse.js'

export type Lut3dGradeOptions = {
  intensity?: number
  maxDimension?: number
}

const DEFAULT_INTENSITY = 0.3
const DEFAULT_MAX_DIMENSION = 1024

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_LUT_PATH = path.join(moduleDir, 'luts', 'classic-chrome.3dl')

let cachedDefaultLut: ParsedLut3d | null = null

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampIntensity(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return DEFAULT_INTENSITY
  return clamp01(value)
}

/** Sample 3D LUT with trilinear interpolation; input order matches fujilab WebGL (BGR axes). */
export function sampleLut3dTrilinear(lut: ParsedLut3d, r: number, g: number, b: number): [number, number, number] {
  const { size, data } = lut
  const scale = (size - 1) / size
  const offset = 0.5 / size
  const bx = clamp01(b) * scale + offset
  const gy = clamp01(g) * scale + offset
  const rz = clamp01(r) * scale + offset

  const maxIdx = size - 1
  const x0 = Math.min(maxIdx, Math.floor(bx * maxIdx))
  const x1 = Math.min(maxIdx, x0 + 1)
  const y0 = Math.min(maxIdx, Math.floor(gy * maxIdx))
  const y1 = Math.min(maxIdx, y0 + 1)
  const z0 = Math.min(maxIdx, Math.floor(rz * maxIdx))
  const z1 = Math.min(maxIdx, z0 + 1)

  const tx = bx * maxIdx - x0
  const ty = gy * maxIdx - y0
  const tz = rz * maxIdx - z0

  const idx = (xi: number, yi: number, zi: number) => ((zi * size + yi) * size + xi) * 3

  const c000 = idx(x0, y0, z0)
  const c100 = idx(x1, y0, z0)
  const c010 = idx(x0, y1, z0)
  const c110 = idx(x1, y1, z0)
  const c001 = idx(x0, y0, z1)
  const c101 = idx(x1, y0, z1)
  const c011 = idx(x0, y1, z1)
  const c111 = idx(x1, y1, z1)

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const out: [number, number, number] = [0, 0, 0]
  for (let ch = 0; ch < 3; ch++) {
    const v000 = data[c000 + ch]
    const v100 = data[c100 + ch]
    const v010 = data[c010 + ch]
    const v110 = data[c110 + ch]
    const v001 = data[c001 + ch]
    const v101 = data[c101 + ch]
    const v011 = data[c011 + ch]
    const v111 = data[c111 + ch]
    const x00 = lerp(v000, v100, tx)
    const x10 = lerp(v010, v110, tx)
    const x01 = lerp(v001, v101, tx)
    const x11 = lerp(v011, v111, tx)
    const y0v = lerp(x00, x10, ty)
    const y1v = lerp(x01, x11, ty)
    out[ch] = clamp01(lerp(y0v, y1v, tz))
  }
  return out
}

export async function loadLut3dFromFile(lutPath: string): Promise<ParsedLut3d> {
  const text = await fs.readFile(lutPath, 'utf8')
  const lower = lutPath.toLowerCase()
  if (lower.endsWith('.cube')) return parseCube(text)
  return parse3DL(text)
}

export async function loadDefaultLut3d(): Promise<ParsedLut3d> {
  if (!cachedDefaultLut) {
    cachedDefaultLut = await loadLut3dFromFile(DEFAULT_LUT_PATH)
  }
  return cachedDefaultLut
}

export function applyLut3dToRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  lut: ParsedLut3d,
  intensity: number,
): void {
  const mix = clampIntensity(intensity)
  const px = width * height
  for (let i = 0; i < px; i++) {
    const o = i * 4
    const r = rgba[o] / 255
    const g = rgba[o + 1] / 255
    const b = rgba[o + 2] / 255
    const a = rgba[o + 3]
    const [lr, lg, lb] = sampleLut3dTrilinear(lut, r, g, b)
    rgba[o] = Math.round((r + (lr - r) * mix) * 255)
    rgba[o + 1] = Math.round((g + (lg - g) * mix) * 255)
    rgba[o + 2] = Math.round((b + (lb - b) * mix) * 255)
    rgba[o + 3] = a
  }
}

export async function applyLut3dToPngBuffer(
  input: Buffer,
  lutOrPath: ParsedLut3d | string = DEFAULT_LUT_PATH,
  options: Lut3dGradeOptions = {},
): Promise<Buffer> {
  const lut = typeof lutOrPath === 'string' ? await loadLut3dFromFile(lutOrPath) : lutOrPath
  const intensity = clampIntensity(options.intensity)
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION

  const meta = await sharp(input).metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0
  if (!w || !h) return input

  let pipeline = sharp(input).ensureAlpha()
  if (Math.max(w, h) > maxDimension) {
    pipeline = pipeline.resize({
      width: w >= h ? maxDimension : undefined,
      height: h > w ? maxDimension : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
  const rgba = new Uint8ClampedArray(Buffer.from(data))
  applyLut3dToRgba(rgba, info.width, info.height, lut, intensity)
  return sharp(Buffer.from(rgba), {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

export async function applyLut3dToUint8Source(
  source: Uint8Array | undefined,
  options: Lut3dGradeOptions & { lutPath?: string } = {},
): Promise<Uint8Array | undefined> {
  if (!source || source.length === 0) return source
  const lutPath = options.lutPath ?? DEFAULT_LUT_PATH
  const graded = await applyLut3dToPngBuffer(Buffer.from(source), lutPath, options)
  return new Uint8Array(graded)
}
