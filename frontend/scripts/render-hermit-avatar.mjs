#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SOURCE = process.argv[2] || resolve(
  __dirname,
  '../../.cursor/projects/home-akitav2-projects-4626/assets/c__Users_akitav2_AppData_Roaming_Cursor_User_workspaceStorage_a50cc50be1149bd304676ca17e49fedc_images_image-6664171c-ba7b-4142-88a5-890aeb04278f.png',
)
const OUT = process.argv[3] || resolve(__dirname, '../public/assets/hermit-avatar.png')
const SIZE = Number(process.argv[4]) || 384

const RENDERER_PATH = resolve(
  __dirname,
  '../api/_handlers/token/_premiumTokenIconRenderer.ts',
)

const tsx = await import('tsx/esm/api')
const mod = await tsx.tsImport(RENDERER_PATH, import.meta.url)

const srcBytes = await readFile(SOURCE)
process.stdout.write(`source: ${SOURCE} (${srcBytes.byteLength} bytes)\n`)

const png = await mod.renderPremiumTokenIcon({
  size: SIZE,
  sourceImage: new Uint8Array(srcBytes),
  symbol: 'hermit',
  suppressBreakout: true,
  renderPreset: 'standard',
})

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, png)
process.stdout.write(`wrote: ${OUT} (${png.byteLength} bytes)\n`)
