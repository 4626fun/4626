#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const shouldCheck = args.has('--check');
const shouldBuildStrict = args.has('--strict');
const syncCommand = shouldCheck ? 'sync-docs:strict' : 'sync-docs';
const postprocessCommand = shouldCheck ? 'api:postprocess:strict' : 'api:postprocess';

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

run('pnpm', ['-C', 'frontend', 'docs'], 'Generate frontend API docs');
run('forge', ['doc'], 'Generate contract API docs');
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
