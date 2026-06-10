#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

/**
 * Guardrail: every first-party markdown file must be either:
 * 1) covered by sync-docs source rules, or
 * 2) explicitly marked out-of-scope with intent.
 *
 * This prevents silent docs coverage regressions as new docs files are added.
 */

const THIRD_PARTY_PREFIXES = [
  'lib/',
  'node_modules/',
  'target/',
  'out/',
  'cache/',
  'broadcast/',
  'design/audit-source-snapshots/',
];

const EXPLICIT_OUT_OF_SCOPE = [
  // Internal agent/runtime skills, not public docs-site content.
  '.cursor/skills/**',
  // Internal docs intentionally kept out of public docs.4626.fun.
  'docs/_internal/**',
  // Repo/meta docs intentionally kept outside docs.4626.fun nav.
  'AGENTS.md',
  'note.md',
  'RECOVERY.md',
  'RECOVERY_INAPP_BUG.md',
  '.github/pull_request_template.md',
  'apps/docs-site/README.md',
  // Internal design and implementation readmes.
  'design/base-brand-archive/README.md',
  'frontend/public/protocols/README.md',
  'frontend/public/assets/README_ASSETS.md',
  // Internal design/typography working notes, not public docs-site content.
  'DESIGN_REFINEMENT.md',
  'TYPOGRAPHY_AUDIT.md',
  // Indexer and Looker Studio connector readmes are engineering-facing only.
  'indexer/README.md',
  'indexer/scripts/lookerStudioConnector/README.md',
  // Internal audit reports kept in repo for traceability, not public docs.
  'docs/audits/root-audit/SOLIDSECS_AUDIT.md',
  // ZK circuit / ceremony engineering docs (operator-facing, not public site).
  'amoe/circuits/**',
  // Relayer/keeper internal engineering readmes.
  'amoe/relayer/zkproof/README.md',
  'alfaclub/infra/cloudflare-proxy/README.md',
  'docs/operations/alfaclub/token-rotation.md',
  // SEO assets engineering readme.
  'seo/README.md',
  // Repo-level meta doc (single sign-on notes), peer of note.md.
  'sso.md',
  // ZK tooling engineering readme.
  'amoe/tools/zk/README.md',
  // Hermit (Pinata) agent persona/seed files — runtime-loaded prompts, not public docs.
  'frontend/server/_lib/hermit/seed/**',
];

function gitLines(args) {
  const output = execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  return output ? output.split('\n').filter(Boolean) : [];
}

function matchesPattern(filePath, pattern) {
  if (pattern.endsWith('/**')) {
    return filePath.startsWith(pattern.slice(0, -3));
  }
  return filePath === pattern;
}

function isThirdParty(filePath) {
  return THIRD_PARTY_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function isExplicitlyOutOfScope(filePath) {
  return EXPLICIT_OUT_OF_SCOPE.some((pattern) => matchesPattern(filePath, pattern));
}

function isGeneratedOutput(filePath) {
  return filePath.startsWith('docs/_generated/')
    || filePath.startsWith('apps/docs-site/docs/');
}

function isCoveredByManualSource(filePath) {
  if (!filePath.startsWith('docs/')) return false;
  if (filePath.startsWith('docs/_generated/')) return false;
  if (filePath.startsWith('docs/_internal/')) return false;
  if (filePath.startsWith('docs/_archive/')) return false;
  if (filePath.startsWith('docs/archive/')) return false;
  if (filePath.startsWith('docs/drafts/')) return false;
  if (filePath.startsWith('docs/_drafts/')) return false;
  return true;
}

function isCoveredByCreSource(filePath) {
  if (!filePath.startsWith('kpr/')) return false;
  if (filePath.includes('/node_modules/')) return false;
  if (filePath.includes('/kpr-workflows/') && filePath.includes('/node_modules/')) return false;
  if (filePath.includes('/patches/')) return false;
  if (filePath.includes('/dist/')) return false;
  return true;
}

function isCoveredByFrontendSource(filePath) {
  if (!filePath.startsWith('frontend/')) return false;

  const excludedPrefixes = [
    'frontend/node_modules/',
    'frontend/dist/',
    'frontend/src/',
    'frontend/api/',
    'frontend/server/',
    'frontend/abis/',
    'frontend/public/',
    'frontend/scripts/',
    'frontend/v4-subgraph/',
  ];
  if (excludedPrefixes.some((prefix) => filePath.startsWith(prefix))) return false;

  return true;
}

function isCoveredBySyncSources(filePath) {
  return isCoveredByManualSource(filePath)
    || isCoveredByCreSource(filePath)
    || isCoveredByFrontendSource(filePath)
    || filePath === 'README.md'
    || filePath === 'SECURITY.md'
    || filePath === 'deployments/README.md'
    || filePath.startsWith('script/agent-runtime/skills/')
    || filePath === 'frontend/server/agents/eliza/README.md'
    || filePath === 'frontend/server/solana-provisioner/README.md';
}

const trackedFiles = gitLines(['ls-files']);
const markdownFiles = trackedFiles.filter((file) => file.endsWith('.md') || file.endsWith('.mdx'));

const uncovered = [];
for (const filePath of markdownFiles) {
  if (isThirdParty(filePath)) continue;
  if (isGeneratedOutput(filePath)) continue;
  if (isCoveredBySyncSources(filePath)) continue;
  if (isExplicitlyOutOfScope(filePath)) continue;
  uncovered.push(filePath);
}

if (uncovered.length > 0) {
  console.error('[docs] Uncovered first-party markdown files detected:');
  for (const filePath of uncovered) {
    console.error(`- ${filePath}`);
  }
  console.error('\n[docs] Each file must be either:');
  console.error('1) Included by apps/docs-site/scripts/sync-docs.mjs source rules, or');
  console.error('2) Added to EXPLICIT_OUT_OF_SCOPE in check-docs-source-coverage.mjs.');
  process.exit(1);
}

console.log(
  `[docs] Coverage guard passed: ${markdownFiles.length} tracked markdown files evaluated with no uncovered first-party docs.`,
);
