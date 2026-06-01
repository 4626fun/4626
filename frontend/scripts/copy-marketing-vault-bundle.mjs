#!/usr/bin/env node
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
