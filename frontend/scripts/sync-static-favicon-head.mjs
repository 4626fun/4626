#!/usr/bin/env node
/**
 * Align static public HTML shells with the single /favicon.ico head policy.
 * Base App loads 4626.fun/ as immersive/index.html and ignores ?v= query params.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const frontendRoot = path.resolve(process.cwd())
const publicRoot = path.join(frontendRoot, 'public')
const siteConfigPath = path.join(frontendRoot, 'shared/site-config.json')

const siteConfig = JSON.parse(await fs.readFile(siteConfigPath, 'utf8'))
const version = Number(siteConfig.brandAssetVersion ?? 3)
const baseAppId = '695a49dc4d3a403912ed8ca5'
const baseAppIconPath = siteConfig.assets?.baseAppIcon ?? '/assets/base-app-icon-1024.png'
const miniappSplashPath = siteConfig.assets?.miniappSplash ?? '/assets/base-miniapp-icon-200.png'
const miniappTileUrl = `https://4626.fun${baseAppIconPath}?v=${version}`
const miniappSplashUrl = `https://4626.fun${miniappSplashPath}?v=${version}`
const appShellSplashUrl = `https://app.4626.fun${miniappSplashPath}?v=${version}`
const ogImageUrl = `https://4626.fun${siteConfig.assets?.ogImage ?? '/assets/og-image.png'}?v=${version}`
const twitterImageUrl = `https://4626.fun${siteConfig.assets?.twitterImage ?? '/assets/twitter-card.png'}?v=${version}`
const logoPngUrl = `https://4626.fun${siteConfig.assets?.logoPng ?? '/assets/logo-mark-1024.png'}?v=${version}`

const immersiveBaseMetaStart = '<!-- @4626/base-app-head:start -->'
const immersiveBaseMetaEnd = '<!-- @4626/base-app-head:end -->'
const immersiveBaseMetaBlock = `${immersiveBaseMetaStart}
    <meta name="base:app_id" content="${baseAppId}" />
    <meta
      name="fc:miniapp"
      content='{"version":"next","imageUrl":"${miniappTileUrl}","button":{"title":"Open 4626.fun","action":{"type":"launch_miniapp","name":"4626.fun","url":"https://4626.fun/","splashImageUrl":"${miniappSplashUrl}","splashBackgroundColor":"#000000"}}}'
    />
    <meta
      name="fc:frame"
      content='{"version":"next","imageUrl":"${miniappTileUrl}","button":{"title":"Open 4626.fun","action":{"type":"launch_frame","name":"4626.fun","url":"https://4626.fun/","splashImageUrl":"${miniappSplashUrl}","splashBackgroundColor":"#000000"}}}'
    />
${immersiveBaseMetaEnd}
`

const canonicalBlock = `    <link rel="icon" href="/favicon.ico?v=${version}" sizes="any" />`

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

function injectImmersiveBaseMeta(html) {
  const blockPattern = /<!-- @4626\/base-app-head:start -->[\s\S]*?<!-- @4626\/base-app-head:end -->\n?/
  if (blockPattern.test(html)) {
    return html.replace(blockPattern, immersiveBaseMetaBlock)
  }
  return html.replace(
    /(<meta name="msapplication-TileColor" content="[^"]*" \/>\s*)/i,
    `$1${immersiveBaseMetaBlock}\n`,
  )
}

async function syncFarcasterManifest() {
  const farcasterPath = path.join(publicRoot, '.well-known/farcaster.json')
  const manifest = JSON.parse(await fs.readFile(farcasterPath, 'utf8'))
  const miniappVersion = String(Math.max(12, Number(manifest.miniapp?.version ?? 0) + 1))
  manifest.miniapp = {
    ...manifest.miniapp,
    version: miniappVersion,
    iconUrl: miniappTileUrl,
    splashImageUrl: miniappSplashUrl,
    heroImageUrl: miniappTileUrl,
    screenshotUrls: [miniappTileUrl],
  }
  await fs.writeFile(farcasterPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

function syncAgentRegistrationMirror() {
  const syncScript = path.join(frontendRoot, 'scripts/sync-agent-registration.ts')
  const result = spawnSync('pnpm', ['exec', 'tsx', syncScript], {
    cwd: frontendRoot,
    stdio: 'inherit',
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error('sync-agent-registration failed while refreshing ERC-8004 mirror files')
  }
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
    let after = injectCanonicalHead(before)
    if (path.relative(publicRoot, filePath) === 'immersive/index.html') {
      after = injectImmersiveBaseMeta(after)
    }
    if (after !== before) {
      await fs.writeFile(filePath, after)
      updated += 1
      // eslint-disable-next-line no-console
      console.log(`updated ${path.relative(publicRoot, filePath)}`)
    }
  }

  await syncManifestFiles()
  await syncFarcasterManifest()
  syncAgentRegistrationMirror()

  // eslint-disable-next-line no-console
  console.log(`synced favicon head on ${updated} static html file(s)`)
}

await main()
