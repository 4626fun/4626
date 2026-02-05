#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const qmdBin = process.env.QMD_BIN ?? 'qmd';

function run(args, options = {}) {
  const { allowFail = false } = options;
  const res = spawnSync(qmdBin, args, { stdio: 'inherit' });
  if (res.error) {
    if (!allowFail) {
      console.error(`[qmd-setup] Failed to run ${qmdBin}: ${res.error.message}`);
      process.exit(1);
    }
    return false;
  }
  if (typeof res.status === 'number' && res.status !== 0 && !allowFail) {
    process.exit(res.status);
  }
  return res.status === 0;
}

function ensureQmd() {
  const res = spawnSync(qmdBin, ['--help'], { stdio: 'ignore' });
  if (res.error || res.status !== 0) {
    console.error('[qmd-setup] qmd not found in PATH.');
    console.error('[qmd-setup] Install with: bun install -g github:tobi/qmd');
    console.error('[qmd-setup] Or set QMD_BIN to the full path.');
    process.exit(1);
  }
}

const repoRoot = path.resolve(__dirname, '../../..');
const docsDir = path.join(repoRoot, 'docs');
const frontendSrcDir = path.join(repoRoot, 'frontend', 'src');
const frontendApiDir = path.join(repoRoot, 'frontend', 'api');
const frontendServerDir = path.join(repoRoot, 'frontend', 'server');

if (!existsSync(docsDir)) {
  console.error(`[qmd-setup] docs directory not found at: ${docsDir}`);
  process.exit(1);
}

ensureQmd();

console.log('[qmd-setup] Adding docs collection...');
run(['collection', 'add', docsDir, '--name', 'cv-docs', '--mask', '**/*.md*'], { allowFail: true });

console.log('[qmd-setup] Adding context hints...');
run(['context', 'add', 'qmd://cv-docs', 'CreatorVault docs (manual and generated sources).'], {
  allowFail: true,
});
run(
  [
    'context',
    'add',
    'qmd://cv-docs/_generated/contracts/src',
    'Solidity API docs (forge doc output).',
  ],
  { allowFail: true }
);
run(
  [
    'context',
    'add',
    'qmd://cv-docs/_generated/frontend',
    'Frontend API docs (typedoc output).',
  ],
  { allowFail: true }
);

if (existsSync(frontendSrcDir)) {
  console.log('[qmd-setup] Adding frontend src collection...');
  run(['collection', 'add', frontendSrcDir, '--name', 'cv-code-frontend-src', '--mask', '**/*.ts*'], {
    allowFail: true,
  });
  run(['context', 'add', 'qmd://cv-code-frontend-src', 'Frontend app source (React).'], {
    allowFail: true,
  });
}

if (existsSync(frontendApiDir)) {
  console.log('[qmd-setup] Adding frontend API collection...');
  run(['collection', 'add', frontendApiDir, '--name', 'cv-code-frontend-api', '--mask', '**/*.ts*'], {
    allowFail: true,
  });
  run(['context', 'add', 'qmd://cv-code-frontend-api', 'Frontend API handlers (serverless).'], {
    allowFail: true,
  });
}

if (existsSync(frontendServerDir)) {
  console.log('[qmd-setup] Adding frontend server collection...');
  run(
    ['collection', 'add', frontendServerDir, '--name', 'cv-code-frontend-server', '--mask', '**/*.ts*'],
    { allowFail: true }
  );
  run(['context', 'add', 'qmd://cv-code-frontend-server', 'Frontend server utilities.'], {
    allowFail: true,
  });
}

console.log('[qmd-setup] Done. Next: run `qmd embed` to build the index.');
