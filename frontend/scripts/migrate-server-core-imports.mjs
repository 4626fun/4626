#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

const root = process.cwd();

const files = await glob('**/*.{ts,tsx}', {
  cwd: root,
  ignore: ['node_modules/**', '**/dist/**', '**/v4-subgraph/**'],
});

let updated = 0;

for (const rel of files) {
  const full = path.join(root, rel);
  let src = readFileSync(full, 'utf8');
  const before = src;

  // Match any relative path segment ending in packages/server-core/src/THING.js (or without .js)
  src = src.replace(
    /from\s+['"](?:\.\.\/)+packages\/server-core\/src\/([^'".]+)(?:\.js)?['"]/g,
    (match, sub) => {
      if (sub === 'index') {
        return `from '@4626/server-core'`;
      }
      return `from '@4626/server-core/${sub}'`;
    }
  );

  if (src !== before) {
    writeFileSync(full, src);
    updated++;
    console.log('Updated:', rel);
  }
}

console.log(`\nMigration complete. Updated ${updated} files.`);
console.log('Review the changes with `git diff` and commit.');
