#!/usr/bin/env node

/**
 * Ensures sidebar doc IDs are covered by curatedPublishAllowlist.mjs when
 * DOCS_PUBLISH_CURATED=1 (production docs.4626.fun build).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CURATED_PUBLISH_GLOBS } from '../curatedPublishAllowlist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_SITE_ROOT = path.resolve(__dirname, '..');

/** Docusaurus doc id → markdown path under docs/ */
const DOC_ID_TO_PATH = {
  index: 'index.md',
  'connection-methods': '4626-connection-methods.md',
  'security/agent-security-model': 'security/4626-agent-security-model.md',
  PUBLISHING: 'PUBLISHING.md',
  'wallet-architecture': 'wallet-architecture.md',
  ACCOUNT_MODEL: 'ACCOUNT_MODEL.md',
  'audits/README': 'audits/README.md',
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
  for (const match of source.matchAll(/doc\(\s*'([^']+)'/g)) {
    ids.add(match[1]);
  }
  for (const match of source.matchAll(/^\s+'([a-zA-Z][\w./-]+)',?\s*$/gm)) {
    const value = match[1];
    if (value.includes('/') || value === 'PUBLISHING') {
      ids.add(value);
    }
  }
  return ids;
}

const sidebarSources = [
  path.join(DOCS_SITE_ROOT, 'sidebars.ts'),
  path.join(DOCS_SITE_ROOT, 'src/lib/operationsSidebar.ts'),
];

const docIds = new Set();
for (const filePath of sidebarSources) {
  const source = readFileSync(filePath, 'utf8');
  for (const id of extractDocIds(source)) {
    docIds.add(id);
  }
}

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
