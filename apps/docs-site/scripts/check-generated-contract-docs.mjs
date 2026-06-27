#!/usr/bin/env node

/**
 * Warns or fails when auto-generated contract docs contain retired product facts.
 * Runs on docs/_generated/contracts (all .md files) when that tree exists (post-forge doc).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const GENERATED_ROOT = path.join(REPO_ROOT, 'docs/_generated/contracts');

const STALE_PATTERNS = [
  { pattern: /40\s*\/\s*40\s*\/\s*20/i, label: '40/40/20 split' },
  { pattern: /40%\s*CCA/i, label: '40% CCA allocation' },
  { pattern: /40%\s*creator\s*vesting/i, label: '40% vesting allocation' },
  { pattern: /20%\s*LP\s*reserve/i, label: '20% LP reserve' },
  { pattern: /5M\s+tokens/i, label: '5M deposit minimum' },
];

function main() {
  if (!existsSync(GENERATED_ROOT)) {
    console.log('[check:generated-contract-docs] skip — no docs/_generated/contracts (run forge doc first)');
    process.exit(0);
  }

  const files = fg.sync('**/*.md', { cwd: GENERATED_ROOT, absolute: true });
  if (files.length === 0) {
    console.log('[check:generated-contract-docs] skip — empty generated contracts tree');
    process.exit(0);
  }

  const violations = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = path.relative(REPO_ROOT, file);

    for (const { pattern, label } of STALE_PATTERNS) {
      if (pattern.test(text)) {
        violations.push({ file: rel, label });
      }
    }
  }

  if (violations.length === 0) {
    console.log(`[check:generated-contract-docs] ok — scanned ${files.length} file(s)`);
    process.exit(0);
  }

  console.error('[check:generated-contract-docs] stale generated contract docs:\n');
  for (const v of violations) {
    console.error(`  - ${v.file}: ${v.label}`);
  }
  console.error('\nRegenerate with `pnpm -C apps/docs-site generate:contracts` or update NatSpec in contracts/.');
  process.exit(1);
}

main();
