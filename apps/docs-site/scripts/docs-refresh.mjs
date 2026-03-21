#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const shouldCheck = args.has('--check');
const shouldBuildStrict = args.has('--strict');
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

async function normalizeGeneratedSourceLinks(dir) {
  const fullDir = path.join(repoRoot, dir);
  let files;
  try {
    files = await walkMarkdownFiles(fullDir);
  } catch {
    return;
  }

  const blobRefPattern = /https:\/\/github\.com\/wenakita\/4626\/blob\/[0-9a-f]{7,40}\//g;
  const stablePrefix = `https://github.com/wenakita/4626/blob/${docsGitRef}/`;
  let rewritten = 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const next = content.replace(blobRefPattern, stablePrefix);
    if (next !== content) {
      await fs.writeFile(file, next);
      rewritten++;
    }
  }

  console.log(`[docs] Normalized source links in ${rewritten} generated files under ${dir}`);
}

run('pnpm', ['-C', 'frontend', 'docs'], 'Generate frontend API docs');
run('forge', ['doc'], 'Generate contract API docs');
await normalizeGeneratedSourceLinks('docs/_generated/frontend');
await normalizeGeneratedSourceLinks('docs/_generated/contracts');
run('pnpm', ['-C', 'apps/docs-site', syncCommand], 'Sync docs site sources');
run('pnpm', ['-C', 'apps/docs-site', postprocessCommand], 'Postprocess docs site API output');

if (shouldCheck) {
  run(
    'git',
    ['diff', '--exit-code', '--', ...generatedTargets],
    'Verify generated docs are committed',
  );
}

if (shouldBuildStrict) {
  run('pnpm', ['-C', 'apps/docs-site', 'build:strict'], 'Run strict docs build');
}
