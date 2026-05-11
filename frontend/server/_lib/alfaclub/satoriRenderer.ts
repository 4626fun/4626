// @ts-expect-error - wawoff2 ships no types
import * as wawoff2Default from 'wawoff2'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import sharp from 'sharp'

let satoriPromise: Promise<typeof import('satori').default> | null = null

async function loadSatori(): Promise<typeof import('satori').default> {
  if (!satoriPromise) {
    satoriPromise = import('satori').then((mod) => mod.default)
  }
  return satoriPromise
}

const require = createRequire(import.meta.url)

const FONT_SOURCES: Array<{
  name: 'Inter' | 'JetBrains Mono'
  weight: number
  packagePath: string
}> = [
  { name: 'Inter', weight: 400, packagePath: '@fontsource/inter/files/inter-latin-400-normal.woff2' },
  { name: 'Inter', weight: 500, packagePath: '@fontsource/inter/files/inter-latin-500-normal.woff2' },
  { name: 'Inter', weight: 600, packagePath: '@fontsource/inter/files/inter-latin-600-normal.woff2' },
  { name: 'Inter', weight: 700, packagePath: '@fontsource/inter/files/inter-latin-700-normal.woff2' },
  {
    name: 'JetBrains Mono',
    weight: 500,
    packagePath: '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2',
  },
]

export type SatoriFont = {
  name: 'Inter' | 'JetBrains Mono'
  data: ArrayBuffer
  weight: number
  style: 'normal'
}

let fontsPromise: Promise<SatoriFont[]> | null = null

type WawoffModule = {
  decompress: (input: Uint8Array) => Promise<Uint8Array>
}

function loadWawoff(): WawoffModule {
  const mod = wawoffDefault as unknown as Partial<WawoffModule> & { default?: Partial<WawoffModule> }
  const fn = mod.decompress ?? mod.default?.decompress
  if (!fn) throw new Error('wawoff2 decompress not available')
  return { decompress: fn }
}

const wawoffDefault: unknown = wawoff2Default

async function loadFonts(): Promise<SatoriFont[]> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const wawoff = loadWawoff()
      const out: SatoriFont[] = []
      for (const entry of FONT_SOURCES) {
        const resolved = require.resolve(entry.packagePath)
        const buf = await readFile(resolved)
        const ttf = await wawoff.decompress(new Uint8Array(buf))
        const copy = new Uint8Array(ttf.byteLength)
        copy.set(ttf)
        out.push({
          name: entry.name,
          weight: entry.weight as SatoriFont['weight'],
          style: 'normal',
          data: copy.buffer as ArrayBuffer,
        })
      }
      return out
    })()
    fontsPromise.catch(() => {
      fontsPromise = null
    })
  }
  return fontsPromise
}

type StyleObject = Record<string, string | number>

export type SatoriNode = {
  type: string
  // satori accepts arbitrary props on host elements (e.g. SVG attrs like d, x1, cx).
  // Keep the type permissive so chart templates can pass them without per-attr declaration.
  props: {
    style?: StyleObject
    children?: SatoriNodeChild
    [attr: string]: unknown
  }
}

type SatoriNodeChild =
  | SatoriNode
  | string
  | number
  | null
  | undefined
  | false
  | Array<SatoriNode | string | number | null | undefined | false>

export function h(
  type: string,
  style: StyleObject = {},
  ...children: Array<SatoriNode | string | number | null | undefined | false>
): SatoriNode {
  const filtered: Array<SatoriNode | string | number> = []
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    filtered.push(child)
  }
  return {
    type,
    props: {
      style,
      children: filtered.length === 1 ? filtered[0] : filtered,
    },
  }
}

export async function renderSatoriPng(
  tree: SatoriNode,
  opts: { width: number; height: number; pixelRatio?: number },
): Promise<Uint8Array> {
  const satori = await loadSatori()
  const fonts = await loadFonts()
  const svg = await satori(tree as never, {
    width: opts.width,
    height: opts.height,
    fonts: fonts as never,
  })
  const ratio = opts.pixelRatio ?? 2
  const png = await sharp(Buffer.from(svg))
    .resize({
      width: Math.round(opts.width * ratio),
      height: Math.round(opts.height * ratio),
      fit: 'fill',
    })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return new Uint8Array(png)
}
