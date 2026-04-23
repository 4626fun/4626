#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = new Set(process.argv.slice(2));
const shouldCheck = args.has('--check');
const shouldBuildStrict = args.has('--strict');
const skipContractDocs = args.has('--skip-contract-docs');
const syncCommand = shouldCheck ? 'sync-docs:strict' : 'sync-docs';
const postprocessCommand = shouldCheck ? 'api:postprocess:strict' : 'api:postprocess';
const repoRoot = process.cwd();
const docsGitRef = process.env.DOCS_GITHUB_REF || 'main';

const generatedTargets = [
  'docs/_generated',
  'apps/docs-site/docs',
  'apps/docs-site/static/brand',
];

function run(command, commandArgs, label) {
  console.log(`\n[docs] ${label}`);
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCapture(command, commandArgs, label) {
  console.log(`\n[docs] ${label}`);
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  console.log(`[docs] ${label} OK`);
}

function verifyGeneratedTargetsCommitted(targets) {
  console.log('\n[docs] Verify generated docs are committed');
  const diffCheck = spawnSync(
    'git',
    ['--no-pager', 'diff', '--quiet', '--exit-code', '--', ...targets],
    {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    },
  );
  if (diffCheck.status !== 0) {
    console.log('[docs] Generated docs drift detected (name-status):');
    spawnSync(
      'git',
      ['--no-pager', 'diff', '--name-status', '--', ...targets],
      {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
      },
    );
    // Print the first 200 lines of the actual diff so CI logs show what
    // differs, not just which file. Critical for diagnosing env-specific
    // drift (e.g. a file generated locally but not in CI, or vice versa).
    console.log('\n[docs] Generated docs drift detected (first 200 lines of diff):');
    spawnSync(
      'bash',
      ['-c', `git --no-pager diff -- ${targets.map((t) => `'${t}'`).join(' ')} | head -n 200`],
      {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
      },
    );
    process.exit(diffCheck.status ?? 1);
  }
  console.log('[docs] Verify generated docs are committed OK');
}

async function walkMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

// Match any previously-emitted blob ref: raw commit SHA (7-40 hex chars)
// OR a literal "main" ref. The literal-main rewrite matters for non-main
// docs builds (e.g. release-branch docs regeneration under DOCS_GITHUB_REF)
// so links land on the branch being documented, not stale main content.
//
// Exported so integration tests can exercise the rewrite under a simulated
// release-branch ref (see apps/docs-site/scripts/__tests__/source-link-ref-e2e.test.mjs).
export const BLOB_REF_PATTERN =
  /https:\/\/github\.com\/wenakita\/4626\/blob\/(?:[0-9a-f]{7,40}|main)\//g;

export function rewriteBlobRefs(content, gitRef) {
  const stablePrefix = `https://github.com/wenakita/4626/blob/${gitRef}/`;
  // Reset regex state (global flag) before reuse across calls.
  BLOB_REF_PATTERN.lastIndex = 0;
  return content.replace(BLOB_REF_PATTERN, stablePrefix);
}

async function normalizeGeneratedSourceLinks(dir) {
  const fullDir = path.join(repoRoot, dir);
  let files;
  try {
    files = await walkMarkdownFiles(fullDir);
  } catch {
    return;
  }

  let rewritten = 0;
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const next = rewriteBlobRefs(content, docsGitRef);
    if (next !== content) {
      await fs.writeFile(file, next);
      rewritten++;
    }
  }

  console.log(`[docs] Normalized source links in ${rewritten} generated files under ${dir}`);
}

// Only run the pipeline when executed directly, not when imported as a
// module (e.g. by integration tests that reuse `rewriteBlobRefs`).
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '');

if (isMainModule) {
  run('pnpm', ['-C', 'frontend', 'docs'], 'Generate frontend API docs');
  if (!skipContractDocs) {
    run('forge', ['doc'], 'Generate contract API docs');
  } else {
    console.log('\n[docs] Skip contract API docs (frontend/docs-site only)');
  }
  if (shouldCheck) {
    run('node', ['apps/docs-site/scripts/check-docs-source-coverage.mjs'], 'Verify docs source coverage');
    run('node', ['apps/docs-site/scripts/audit-docs-hygiene.mjs', '--strict-stale'], 'Audit docs hygiene (staleness gate)');
  }
  await normalizeGeneratedSourceLinks('docs/_generated/frontend');
  if (!skipContractDocs) {
    await normalizeGeneratedSourceLinks('docs/_generated/contracts');
  }
  run('pnpm', ['-C', 'apps/docs-site', syncCommand], 'Sync docs site sources');
  run('pnpm', ['-C', 'apps/docs-site', postprocessCommand], 'Postprocess docs site API output');
  if (shouldCheck) {
    run('node', ['apps/docs-site/scripts/check-docs-hygiene-policy.mjs'], 'Verify docs hygiene policy');
  }

  if (shouldCheck) {
    verifyGeneratedTargetsCommitted(generatedTargets);
  }

  if (shouldBuildStrict) {
    run('pnpm', ['-C', 'apps/docs-site', 'build:strict'], 'Run strict docs build');
  }
}
