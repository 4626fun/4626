#!/usr/bin/env node

/**
 * Ensures sidebar doc IDs are covered by curatedPublishAllowlist.mjs.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CURATED_PUBLISH_GLOBS } from '../curatedPublishAllowlist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIDEBARS_PATH = path.resolve(__dirname, '../sidebars.ts');

const DOC_ID_TO_PATH = {
  index: 'index.md',
};

function docIdToPath(docId) {
  if (DOC_ID_TO_PATH[docId]) {
    return DOC_ID_TO_PATH[docId];
  }
  return `${docId}.md`;
}

function isAllowlisted(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return CURATED_PUBLISH_GLOBS.some((pattern) => {
    if (pattern.endsWith('/**')) {
      const base = pattern.slice(0, -3);
      return normalized === base || normalized.startsWith(`${base}/`);
    }
    return normalized === pattern;
  });
}

function extractDocIds(source) {
  const ids = new Set();
  for (const match of source.matchAll(/id:\s*'([^']+)'/g)) {
    ids.add(match[1]);
  }
  for (const match of source.matchAll(/^\s+'([a-zA-Z][\w./-]+)',?\s*$/gm)) {
    ids.add(match[1]);
  }
  return ids;
}

const source = readFileSync(SIDEBARS_PATH, 'utf8');
const docIds = extractDocIds(source);

const missing = [];
for (const docId of [...docIds].sort()) {
  const relPath = docIdToPath(docId);
  if (!isAllowlisted(relPath)) {
    missing.push({ docId, relPath });
  }
}

if (missing.length > 0) {
  console.error('[docs] Sidebar doc IDs missing from curatedPublishAllowlist.mjs:');
  for (const { docId, relPath } of missing) {
    console.error(`- ${docId} → docs/${relPath}`);
  }
  process.exit(1);
}

console.log(
  `[docs] Curated allowlist guard passed: ${docIds.size} sidebar doc IDs covered (${CURATED_PUBLISH_GLOBS.length} allowlist patterns).`,
);
