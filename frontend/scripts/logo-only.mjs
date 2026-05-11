#!/usr/bin/env node
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { writeFile } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const RENDERER_PATH = resolve(__dirname, '../server/_lib/alfaclub/satoriRenderer.ts')

const tsx = await import('tsx/esm/api')
const rdr = await tsx.tsImport(RENDERER_PATH, import.meta.url)

const tree = rdr.h(
  'div',
  {
    width: 800,
    height: 800,
    display: 'flex',
    backgroundColor: '#5c8cff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  {
    type: 'svg',
    props: {
      width: 720,
      height: 720,
      viewBox: '123 123 778 778',
      children: [
        { type: 'rect', props: { x: 123, y: 123, width: 778, height: 778, rx: 74, fill: '#000000' } },
        { type: 'rect', props: { x: 330, y: 281, width: 121, height: 330, rx: 20, fill: '#ffffff' } },
        { type: 'rect', props: { x: 330, y: 505, width: 377, height: 106, rx: 20, fill: '#ffffff' } },
        { type: 'rect', props: { x: 586, y: 281, width: 121, height: 474, rx: 20, fill: '#ffffff' } },
      ],
    },
  },
)

const bytes = await rdr.renderSatoriPng(tree, { width: 800, height: 800, pixelRatio: 1 })
const out = `/tmp/logo-test-${Date.now()}.png`
await writeFile(out, bytes)
console.log(out)
