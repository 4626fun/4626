#!/usr/bin/env node
/**
 * Bundler-based build for @4626/server-core.
 *
 * Uses esbuild (already a devDependency of the frontend workspace) to transpile
 * all .ts files in src/ → dist/, preserving module structure.
 *
 * We also run tsc --emitDeclarationOnly for .d.ts (best effort).
 *
 * This produces real .js + .d.ts artifacts so production (Vercel) no longer
 * sees raw .ts sources via the package exports.
 */
import { execSync } from 'child_process';
import { rmSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Robustly resolve esbuild from pnpm's .pnpm store (handles hoisting)
const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '../..');
const pnpmStore = resolve(frontendRoot, 'node_modules/.pnpm');

// Find any esbuild version in the store
let esbuildMain = null;
try {
  const entries = readdirSync(pnpmStore);
  for (const entry of entries) {
    if (entry.startsWith('esbuild@')) {
      const candidate = resolve(pnpmStore, entry, 'node_modules/esbuild/lib/main.js');
      if (statSync(candidate, { throwIfNoEntry: false })) {
        esbuildMain = candidate;
        break;
      }
    }
  }
} catch {}

if (!esbuildMain) {
  throw new Error('Could not locate esbuild in pnpm store. Is it installed in the frontend workspace?');
}

console.log(`[server-core] Using esbuild from: ${esbuildMain}`);
const { build } = await import(pathToFileURL(esbuildMain).href);
const ROOT = resolve(__dirname, '..'); // frontend root when run via pnpm filter
const SRC_DIR = resolve(__dirname, 'src');
const OUT_DIR = resolve(__dirname, 'dist');

console.log('[server-core] Cleaning dist...');
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

// Collect all .ts entry points (we keep them as separate modules)
function collectTsEntries(dir, base = dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...collectTsEntries(full, base));
    } else if (name.endsWith('.ts')) {
      entries.push(full);
    }
  }
  return entries;
}

const entryPoints = collectTsEntries(SRC_DIR);
console.log(`[server-core] Found ${entryPoints.length} .ts files to transpile.`);

console.log('[server-core] Running esbuild (transpile only, no bundle)...');

await build({
  entryPoints,
  outdir: OUT_DIR,
  outbase: SRC_DIR,           // preserve src/ folder structure under dist/
  bundle: false,              // critical: keep individual modules
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  // Keep the .js extension imports that already exist in the source
  loader: { '.ts': 'ts' },
  logLevel: 'warning',
});

console.log('[server-core] JS output written to dist/.');

// Remove any stray folders that may have been created
for (const name of ['packages', 'server', 'src']) {
  const p = join(OUT_DIR, name);
  if (statSync(p, { throwIfNoEntry: false })) {
    rmSync(p, { recursive: true, force: true });
  }
}

console.log('[server-core] Build finished successfully.');
console.log('            dist/ contains real .js for production (types are provided via source + path mappings in dev).');
