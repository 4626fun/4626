#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const TEMPLATES_PATH = resolve(__dirname, '../server/_lib/alfaclub/chartTemplates.ts')
const RENDERER_PATH = resolve(__dirname, '../server/_lib/alfaclub/satoriRenderer.ts')

async function loadModules() {
  const tsx = await import('tsx/esm/api')
  const tpl = await tsx.tsImport(TEMPLATES_PATH, import.meta.url)
  const rdr = await tsx.tsImport(RENDERER_PATH, import.meta.url)
  return { tpl, rdr }
}

const TOP_VOLUME_FIXTURE = {
  rows: [
    { name: 'jesse pollak\u2019s degen lounge', volume: 16_618_000_000, subtitle: '@jessepollak' },
    { name: 'cobie alpha club', volume: 9_540_000_000, subtitle: '@cobie' },
    { name: 'farcaster trenches', volume: 5_612_000_000, subtitle: '@dwr' },
    { name: 'bald gentleman\u2019s society', volume: 2_412_000_000, subtitle: '@baldsamax' },
    { name: 'frens of the protocol', volume: 2_388_000_000, subtitle: '@vitalik' },
    { name: 'akita\u2019s rocket lab', volume: 1_410_000_000, subtitle: '@akita' },
  ],
  totalVolume: 86_400_000_000,
}

const TIER_MIX_FIXTURE = {
  segments: [
    { label: 'trading · club', rooms: 638 },
    { label: 'trading · exclusive', rooms: 491 },
    { label: 'social · casual', rooms: 265 },
    { label: 'social · exclusive', rooms: 131 },
    { label: 'social · club', rooms: 120 },
  ],
  totalRooms: 1645,
}

const PNL_FIXTURE = {
  buckets: [
    { bucketStart: -100, bucketEnd: -60, rooms: 12 },
    { bucketStart: -60, bucketEnd: -20, rooms: 22 },
    { bucketStart: -20, bucketEnd: 20, rooms: 1537 },
    { bucketStart: 20, bucketEnd: 60, rooms: 4 },
    { bucketStart: 60, bucketEnd: 100, rooms: 1 },
    { bucketStart: 100, bucketEnd: 140, rooms: 2 },
    { bucketStart: 140, bucketEnd: 180, rooms: 1 },
    { bucketStart: 180, bucketEnd: 220, rooms: 1 },
    { bucketStart: 220, bucketEnd: 260, rooms: 1 },
    { bucketStart: 260, bucketEnd: 300, rooms: 1 },
  ],
  totalRooms: 1582,
}

async function main() {
  const outDir = process.argv[2] || `/tmp/alfa-charts-${Date.now()}`
  await mkdir(outDir, { recursive: true })
  const { tpl, rdr } = await loadModules()
  const canvas = tpl.CHART_CANVAS

  const jobs = [
    { name: 'top-volume.png', tree: tpl.buildTopVolumeTree(TOP_VOLUME_FIXTURE) },
    { name: 'tier-mix.png', tree: tpl.buildTierMixTree(TIER_MIX_FIXTURE) },
    { name: 'pnl-distribution.png', tree: tpl.buildPnlDistributionTree(PNL_FIXTURE) },
  ]

  for (const job of jobs) {
    const bytes = await rdr.renderSatoriPng(job.tree, {
      width: canvas.width,
      height: canvas.height,
      pixelRatio: 1,
    })
    const out = resolve(outDir, job.name)
    await writeFile(out, bytes)
    process.stdout.write(`${out}\n`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
