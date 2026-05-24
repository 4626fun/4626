#!/usr/bin/env node
/**
 * Align static public HTML shells with the single /favicon.ico head policy.
 * Base App loads 4626.fun/ as immersive/index.html and ignores ?v= query params.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const frontendRoot = path.resolve(process.cwd())
const publicRoot = path.join(frontendRoot, 'public')
const siteConfigPath = path.join(frontendRoot, 'shared/site-config.json')

const siteConfig = JSON.parse(await fs.readFile(siteConfigPath, 'utf8'))
const version = Number(siteConfig.brandAssetVersion ?? 3)
const ogImageUrl = `https://4626.fun${siteConfig.assets?.ogImage ?? '/assets/og-image.png'}?v=${version}`
const twitterImageUrl = `https://4626.fun${siteConfig.assets?.twitterImage ?? '/assets/twitter-card.png'}?v=${version}`
const logoPngUrl = `https://4626.fun${siteConfig.assets?.logoPng ?? '/assets/logo-mark-1024.png'}?v=${version}`

const canonicalBlock = '    <link rel="icon" href="/favicon.ico" sizes="any" />'

const canonicalComment =
  '<!-- Single /favicon.ico (Base App domain bar; avoids multi-tag icon flicker). -->'

const iconLinkPattern =
  /<link rel="(?:icon|apple-touch-icon(?:-precomposed)?|mask-icon|shortcut icon)"[^>]*>\s*/gi

const canonicalCommentPattern =
  /<!--\s*(?:Single \/favicon\.ico|Canonical PNG favicon stack)[^]*?-->\s*/g

async function walkHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkHtmlFiles(abs)))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(abs)
    }
  }
  return files
}

function normalizeBrandVersionUrls(html) {
  let next = html
  next = next.replace(/https:\/\/4626\.fun\/assets\/og-image\.png\?v=\d+/g, ogImageUrl)
  next = next.replace(/https:\/\/4626\.fun\/assets\/twitter-card\.png\?v=\d+/g, twitterImageUrl)
  next = next.replace(/https:\/\/4626\.fun\/assets\/logo-mark-1024\.png\?v=\d+/g, logoPngUrl)
  return next
}

function injectCanonicalHead(html) {
  let next = normalizeBrandVersionUrls(html)
  next = next.replace(canonicalCommentPattern, '')
  next = next.replace(iconLinkPattern, '')
  next = next.replace(/<link rel="icon" type="image\/svg\+xml"[^>]*>\s*/gi, '')

  return next.replace(/<head>\s*/i, `<head>\n${canonicalComment}\n${canonicalBlock}\n`)
}

async function syncManifestFiles() {
  const manifestPaths = [
    path.join(publicRoot, 'site.webmanifest'),
    path.join(publicRoot, 'manifest.json'),
  ]

  for (const manifestPath of manifestPaths) {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    manifest.icons = [
      {
        src: `/assets/android-chrome-192x192.png?v=${version}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `/assets/android-chrome-512x512.png?v=${version}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ]
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  const browserConfigPath = path.join(publicRoot, 'browserconfig.xml')
  const browserConfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/assets/mstile-150x150.png?v=${version}"/>
      <TileColor>#020204</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`
  await fs.writeFile(browserConfigPath, browserConfig)
}

async function main() {
  const htmlFiles = await walkHtmlFiles(publicRoot)
  let updated = 0

  for (const filePath of htmlFiles) {
    const before = await fs.readFile(filePath, 'utf8')
    const after = injectCanonicalHead(before)
    if (after !== before) {
      await fs.writeFile(filePath, after)
      updated += 1
      // eslint-disable-next-line no-console
      console.log(`updated ${path.relative(publicRoot, filePath)}`)
    }
  }

  await syncManifestFiles()

  // eslint-disable-next-line no-console
  console.log(`synced favicon head on ${updated} static html file(s)`)
}

await main()
