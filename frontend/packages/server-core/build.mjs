#!/usr/bin/env node
/**
 * Bundler-based build for @4626/server-core.
 *
 * 1. Bundle each `src/*.ts` → `dist/*.js` with `server/` dependencies inlined so
 *    Vercel never resolves broken `../../../server/*.js` from package dist.
 * 2. Emit bundled `server/_lib/*.js` runtime bridges (e.g. premium token icon)
 *    for server modules that must ship as frontend-relative `.js` siblings.
 */
import { readFileSync, readdirSync, rmSync, mkdirSync, statSync } from 'fs'
import { resolve, dirname, join, relative } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '../..')
const pnpmStore = resolve(frontendRoot, 'node_modules/.pnpm')

let esbuildMain = null
try {
  const entries = readdirSync(pnpmStore)
  for (const entry of entries) {
    if (entry.startsWith('esbuild@')) {
      const candidate = resolve(pnpmStore, entry, 'node_modules/esbuild/lib/main.js')
      if (statSync(candidate, { throwIfNoEntry: false })) {
        esbuildMain = candidate
        break
      }
    }
  }
} catch {}

if (!esbuildMain) {
  throw new Error('Could not locate esbuild in pnpm store. Is it installed in the frontend workspace?')
}

console.log(`[server-core] Using esbuild from: ${esbuildMain}`)
const { build } = await import(pathToFileURL(esbuildMain).href)

const SRC_DIR = resolve(__dirname, 'src')
const OUT_DIR = resolve(__dirname, 'dist')
const REPO_ROOT = resolve(__dirname, '../../..')
const SUPABASE_MIGRATIONS_ROOT = resolve(REPO_ROOT, 'supabase/migrations')

function collectTsEntries(dir) {
  const entries = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      entries.push(...collectTsEntries(full))
      continue
    }
    if (name.endsWith('.ts')) entries.push(full)
  }
  return entries
}

console.log('[server-core] Cleaning dist...')
rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

const entryPoints = collectTsEntries(SRC_DIR)
console.log(`[server-core] Found ${entryPoints.length} package .ts files to bundle.`)

console.log('[server-core] Running esbuild for package src/ → dist/ (bundle per entry)...')
await build({
  entryPoints,
  outdir: OUT_DIR,
  outbase: SRC_DIR,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  loader: { '.ts': 'ts' },
  packages: 'external',
  define: {
    __4626_SUPABASE_MIGRATIONS_ROOT__: JSON.stringify(SUPABASE_MIGRATIONS_ROOT),
  },
  logLevel: 'warning',
})

console.log('[server-core] JS output written to dist/.')

const authOut = join(OUT_DIR, 'auth.js')
const authSource = readFileSync(authOut, 'utf8')
if (authSource.includes('../../../server/')) {
  throw new Error(
    '[server-core] dist/auth.js still references ../../../server — bundle step failed; API routes will 500 in production.',
  )
}

for (const name of ['packages', 'server', 'src']) {
  const stray = join(OUT_DIR, name)
  if (statSync(stray, { throwIfNoEntry: false })) {
    rmSync(stray, { recursive: true, force: true })
  }
}

/** Server modules that import api/_handlers and need bundled .js siblings on Vercel. */
const SERVER_API_RUNTIME_BRIDGE_ENTRY_POINTS = [
  resolve(frontendRoot, 'server/_lib/token/renderPremiumTokenIcon.ts'),
].filter((tsPath) => statSync(tsPath, { throwIfNoEntry: false }))

if (SERVER_API_RUNTIME_BRIDGE_ENTRY_POINTS.length > 0) {
  console.log(
    `[server-core] Emitting ${SERVER_API_RUNTIME_BRIDGE_ENTRY_POINTS.length} server/*.js runtime bridge(s) for Vercel...`,
  )
  for (const tsPath of SERVER_API_RUNTIME_BRIDGE_ENTRY_POINTS) {
    const jsPath = tsPath.replace(/\.ts$/, '.js')
    if (statSync(jsPath, { throwIfNoEntry: false })) {
      rmSync(jsPath, { force: true })
      const mapPath = `${jsPath}.map`
      if (statSync(mapPath, { throwIfNoEntry: false })) rmSync(mapPath, { force: true })
    }
  }
  await build({
    entryPoints: SERVER_API_RUNTIME_BRIDGE_ENTRY_POINTS,
    outdir: frontendRoot,
    outbase: frontendRoot,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: true,
    loader: { '.ts': 'ts' },
    packages: 'external',
    allowOverwrite: true,
    logLevel: 'warning',
  })
  for (const tsPath of SERVER_API_RUNTIME_BRIDGE_ENTRY_POINTS) {
    console.log(`            ${relative(frontendRoot, tsPath.replace(/\.ts$/, '.js'))}`)
  }
}

console.log('[server-core] Build finished successfully.')
console.log('            dist/ contains self-contained .js entrypoints for production.')
