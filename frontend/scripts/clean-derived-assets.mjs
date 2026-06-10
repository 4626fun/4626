#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const publicDir = path.resolve(root, 'public')
const distDir = path.resolve(root, 'dist')
const buildDir = path.resolve(root, 'build')

const derivedPublicAssets = [
  'app-hero.png',
  'icon-192-maskable.png',
  'miniapp-splash.png',
  'pwa-512-maskable.png',
  'screenshot-deploy.png',
  'screenshot-explore.png',
  'screenshot-portrait.png',
  'screenshot-swap.png',
]

async function rmIfExists(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true })
}

async function main() {
  for (const relativePath of derivedPublicAssets) {
    await rmIfExists(path.join(publicDir, relativePath))
  }

  await rmIfExists(distDir)
  await rmIfExists(buildDir)

  console.log(
    `removed ${derivedPublicAssets.length} legacy/UI-derived public assets and cleared dist/build.\n` +
      'Canonical v2 brand assets, root compatibility icons, site.webmanifest, and checked-in source assets were left intact.',
  )
}

await main()
