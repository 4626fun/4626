#!/usr/bin/env node
/**
 * Cleanup script for remaining direct relative references to the old
 * packages/server-core/src/ paths, focused on test mocks + stragglers.
 *
 * Replaces them with the canonical '@4626/server-core' package name.
 */
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

const root = process.cwd();

const patterns = [
  // vi.mock with relative path to server-core barrel
  {
    regex: /vi\.mock\(['"]([^'"]*packages\/server-core\/src\/index\.js)['"]/g,
    replacement: "vi.mock('@4626/server-core'"
  },
  // vi.importActual with type import
  {
    regex: /vi\.importActual<[^>]*>\(['"]([^'"]*packages\/server-core\/src\/index\.js)['"]/g,
    replacement: "vi.importActual('@4626/server-core'"
  },
  // plain import() for the barrel
  {
    regex: /import\(['"]([^'"]*packages\/server-core\/src\/index\.js)['"]/g,
    replacement: "import('@4626/server-core'"
  },
  // Type-only imports of the barrel in tests
  {
    regex: /import\(['"]([^'"]*packages\/server-core\/src\/index\.js)['"]\)/g,
    replacement: "import('@4626/server-core')"
  },
  // Any other direct relative to a specific file under src/ (rare in tests now)
  {
    regex: /from ['"]([^'"]*packages\/server-core\/src\/([^'".]+))(\.js)?['"]/g,
    replacement: (match, full, sub) => {
      if (sub === 'index') return "from '@4626/server-core'";
      return `from '@4626/server-core/${sub}'`;
    }
  }
];

const files = await glob('**/*.{ts,tsx}', {
  cwd: root,
  ignore: ['node_modules/**', '**/dist/**']
});

let updatedCount = 0;

for (const rel of files) {
  const fullPath = path.join(root, rel);
  let content = readFileSync(fullPath, 'utf8');
  const original = content;

  for (const { regex, replacement } of patterns) {
    if (typeof replacement === 'function') {
      content = content.replace(regex, replacement);
    } else {
      content = content.replace(regex, replacement);
    }
  }

  if (content !== original) {
    writeFileSync(fullPath, content);
    updatedCount++;
    console.log(`Updated: ${rel}`);
  }
}

console.log(`\nCleanup complete. Updated ${updatedCount} files.`);
console.log('Run `git diff --name-only` to review.');
