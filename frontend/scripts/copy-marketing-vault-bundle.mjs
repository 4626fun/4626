#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'dist/marketing-vault-hero')
const destDir = path.join(root, 'public/immersive/vault-hero')

const srcFile = path.join(srcDir, 'vault-hero.js')
if (!fs.existsSync(srcFile)) {
  console.error('Missing dist/marketing-vault-hero/vault-hero.js — run vite build first')
  process.exit(1)
}

fs.mkdirSync(destDir, { recursive: true })
for (const name of fs.readdirSync(srcDir)) {
  if (!name.startsWith('vault-hero')) continue
  fs.copyFileSync(path.join(srcDir, name), path.join(destDir, name))
}

console.log(`Copied marketing vault bundle → ${destDir}`)

// Stamp a content-hash cache-bust onto the dynamic import in index.html so
// rebuilt bundles are never served stale (http.server / browsers send no
// Cache-Control and otherwise heuristically pin the old module).
const hash = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(destDir, 'vault-hero.js')))
  .digest('hex')
  .slice(0, 12)

const immersiveDir = path.join(root, 'public/immersive')

/** Short content hash of a file in public/immersive (or null if missing). */
const contentHash = (rel) => {
  const file = path.join(immersiveDir, rel)
  if (!fs.existsSync(file)) return null
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12)
}

const indexFile = path.join(immersiveDir, 'index.html')
if (fs.existsSync(indexFile)) {
  let html = fs.readFileSync(indexFile, 'utf8')
  const before = html

  // 1) R3F bundle dynamic import.
  html = html.replace(
    /vault-hero\/vault-hero\.js(?:\?v=[a-f0-9]+)?/g,
    `vault-hero/vault-hero.js?v=${hash}`,
  )

  // 2) Static stylesheet + vanilla fallback module — content-hash so edits to
  //    styles.css / vault.js are never served stale behind a frozen ?v= literal.
  const stylesHash = contentHash('styles.css')
  if (stylesHash) {
    html = html.replace(/styles\.css\?v=[a-z0-9]+/g, `styles.css?v=${stylesHash}`)
  }
  const vaultHash = contentHash('vault.js')
  if (vaultHash) {
    // Only the real dynamic-import strings (`${immersive}vault.js`), never
    // prose mentions of vault.js in comments.
    html = html.replace(
      /(\$\{immersive\}vault\.js)(?:\?v=[a-z0-9]+)?/g,
      `$1?v=${vaultHash}`,
    )
  }

  if (html !== before) {
    fs.writeFileSync(indexFile, html)
    console.log(
      `Stamped cache-bust → index.html (vault-hero ?v=${hash}` +
        (stylesHash ? `, styles ?v=${stylesHash}` : '') +
        (vaultHash ? `, vault ?v=${vaultHash}` : '') +
        ')',
    )
  } else {
    console.log('cache-bust already current')
  }
}
