#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const outputJson = args.has('--json');
const outputGithub = args.has('--github-output');

const exactMatches = new Set([
  'README.md',
  'SECURITY.md',
  'deployments/README.md',
  'foundry.toml',
  'package.json',
  'frontend/package.json',
  'frontend/typedoc.json',
  'frontend/tsconfig.docs.json',
  'frontend/README.md',
  'apps/docs-site/package.json',
  'apps/docs-site/README.md',
  // Root-level configs scanned by scripts/check-docs-source-link-pin.mjs.
  'tsconfig.json',
]);

const docsSensitivePrefixes = [
  'docs/',
  'deployments/',
  'frontend/docs/',
  'frontend/src/',
  'frontend/api/',
  'frontend/server/',
  'frontend/scripts/',
  'script/agent-runtime/skills/',
  'apps/docs-site/',
  '.github/workflows/',
  'kpr/',
  'src/',
  'contracts/',
  // Root-level docs pipeline / guard scripts. Changes here must rerun the
  // Docs Drift workflow so CI coverage stays in sync with the code it gates on.
  'scripts/',
];

const contractDocsPrefixes = [
  'contracts/',
  'src/',
];

const contractDocsExactMatches = new Set([
  'foundry.toml',
]);

const manualDocsPrefixes = [
  'docs/',
  'deployments/',
  'script/agent-runtime/skills/',
  'frontend/docs/',
  'kpr/',
];

const manualDocsExactMatches = new Set([
  'README.md',
  'SECURITY.md',
]);

const generatedDocsPrefixes = [
  'docs/_generated/',
  'apps/docs-site/docs/',
  'apps/docs-site/static/brand/',
];

const docsToolingPrefixes = [
  'apps/docs-site/scripts/',
  'frontend/scripts/',
  'scripts/',
  '.github/workflows/',
];

function gitLines(commandArgs) {
  const output = execFileSync('git', commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  return output ? output.split('\n').filter(Boolean) : [];
}

function resolveChangedFiles() {
  const explicitFiles = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (explicitFiles.length > 0) {
    return explicitFiles;
  }

  const stagedFiles = gitLines(['diff', '--name-only', '--cached']);
  const unstagedFiles = gitLines(['diff', '--name-only']);
  const untrackedFiles = gitLines(['ls-files', '--others', '--exclude-standard']);
  const worktreeFiles = [...new Set([...stagedFiles, ...unstagedFiles, ...untrackedFiles])];
  if (worktreeFiles.length > 0) {
    return worktreeFiles;
  }

  const baseSha = process.env.BASE_SHA || process.env.GITHUB_BASE_SHA;
  if (baseSha) {
    return gitLines(['diff', '--name-only', `${baseSha}...HEAD`]);
  }

  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD^'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    return gitLines(['diff', '--name-only', 'HEAD^', 'HEAD']);
  } catch {
    return gitLines(['diff', '--name-only', '--cached']);
  }
}

function matches(path, prefixes, exact = exactMatches) {
  return exact.has(path) || prefixes.some((prefix) => path.startsWith(prefix));
}

function isManualDoc(path) {
  return (manualDocsExactMatches.has(path) || manualDocsPrefixes.some((prefix) => path.startsWith(prefix)))
    && !generatedDocsPrefixes.some((prefix) => path.startsWith(prefix));
}

const changedFiles = resolveChangedFiles();
const docsSensitiveFiles = changedFiles.filter((path) => matches(path, docsSensitivePrefixes));
const generatedDocsTouched = changedFiles.some((path) =>
  generatedDocsPrefixes.some((prefix) => path.startsWith(prefix)));
const manualDocsTouched = changedFiles.some((path) => isManualDoc(path));
const docsToolingTouched = changedFiles.some((path) =>
  matches(path, docsToolingPrefixes));

const result = {
  changedCount: changedFiles.length,
  docsSensitive: docsSensitiveFiles.length > 0,
  manualDocsTouched,
  generatedDocsTouched,
  docsToolingTouched,
  contractDocsSensitive: changedFiles.some((path) =>
    contractDocsExactMatches.has(path)
    || contractDocsPrefixes.some((prefix) => path.startsWith(prefix))),
  changedFiles,
  docsSensitiveFiles,
  recommendedRefreshCommand: 'pnpm docs:refresh',
  recommendedStrictBuildCommand: 'pnpm docs:check',
};

if (outputGithub && process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, [
    `docs_sensitive=${String(result.docsSensitive)}`,
    `manual_docs_touched=${String(result.manualDocsTouched)}`,
    `generated_docs_touched=${String(result.generatedDocsTouched)}`,
    `docs_tooling_touched=${String(result.docsToolingTouched)}`,
    `contract_docs_sensitive=${String(result.contractDocsSensitive)}`,
    `changed_count=${String(result.changedCount)}`,
  ].join('\n') + '\n');
}

if (outputJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(`[docs] Changed files: ${result.changedCount}`);
console.log(`[docs] Docs-sensitive: ${result.docsSensitive ? 'yes' : 'no'}`);
if (result.docsSensitive) {
  console.log('[docs] Matching files:');
  for (const file of result.docsSensitiveFiles) {
    console.log(`- ${file}`);
  }
  console.log(`[docs] Manual docs touched: ${result.manualDocsTouched ? 'yes' : 'no'}`);
  console.log(`[docs] Generated docs touched: ${result.generatedDocsTouched ? 'yes' : 'no'}`);
  console.log(`[docs] Docs tooling touched: ${result.docsToolingTouched ? 'yes' : 'no'}`);
  console.log(`[docs] Contract docs sensitive: ${result.contractDocsSensitive ? 'yes' : 'no'}`);
  console.log(`[docs] Run: ${result.recommendedRefreshCommand}`);
  console.log(`[docs] Validate: ${result.recommendedStrictBuildCommand}`);
}
