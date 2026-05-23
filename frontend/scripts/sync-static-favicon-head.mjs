#!/usr/bin/env node
/**
 * Align every static public HTML shell with the canonical PNG favicon stack.
 * Base App loads 4626.fun/ as immersive/index.html and often ignores ?v= query params.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const frontendRoot = path.resolve(process.cwd())
const publicRoot = path.join(frontendRoot, 'public')
const siteConfigPath = path.join(frontendRoot, 'shared/site-config.json')

const siteConfig = JSON.parse(await fs.readFile(siteConfigPath, 'utf8'))
const version = Number(siteConfig.brandAssetVersion ?? 3)
const favicon16 = `${siteConfig.assets?.favicon16 ?? '/assets/favicon-16x16.png'}?v=${version}`
const favicon32 = `${siteConfig.assets?.favicon32 ?? '/assets/domain-bar-icon-32.png'}?v=${version}`
const appleTouch = `${siteConfig.assets?.appleTouchIcon ?? '/assets/domain-bar-icon-180.png'}?v=${version}`

const canonicalBlock = [
  '    <link rel="icon" type="image/png" sizes="16x16" href="' + favicon16 + '" />',
  '    <link rel="icon" type="image/png" sizes="32x32" href="' + favicon32 + '" />',
  '    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
  '    <link rel="apple-touch-icon" sizes="180x180" href="' + appleTouch + '" />',
  '    <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png" />',
  '    <link rel="icon" href="/favicon.ico" sizes="any" />',
].join('\n')

const legacyIconBlockPattern =
  /<!--(?:\s*Brand favicons[^\n]*|Single PNG favicon stack[^\n]*)-->\s*(?:<link rel="icon"[^>]*>\s*)+/g

const legacyLooseIconPattern =
  /(?:<link rel="icon"[^>]*>\s*)+(?:<link rel="apple-touch-icon"[^>]*>\s*)?(?:<link rel="mask-icon"[^>]*>\s*)?/g

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

function injectCanonicalHead(html) {
  let next = html
  next = next.replace(/<link rel="mask-icon"[^>]*>\s*/g, '')
  next = next.replace(/<link rel="icon" type="image\/svg\+xml"[^>]*>\s*/g, '')

  if (legacyIconBlockPattern.test(next)) {
    legacyIconBlockPattern.lastIndex = 0
    next = next.replace(
      legacyIconBlockPattern,
      `<!-- Canonical PNG favicon stack (Base App domain bar + /favicon.ico). -->\n${canonicalBlock}\n`,
    )
    return next
  }

  if (next.includes('rel="icon"')) {
    next = next.replace(
      /<link rel="icon"[^>]*>\s*(?:<link rel="icon"[^>]*>\s*)*(?:<link rel="apple-touch-icon"[^>]*>\s*)?/,
      `${canonicalBlock}\n`,
    )
    return next
  }

  return next.replace(/<head>\s*/i, `<head>\n${canonicalBlock}\n`)
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

  // eslint-disable-next-line no-console
  console.log(`synced favicon head on ${updated} static html file(s)`)
}

await main()
