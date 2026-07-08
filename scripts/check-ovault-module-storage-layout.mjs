#!/usr/bin/env node
/**
 * Storage-layout guard for CreatorOVault delegatecall modules.
 *
 * Invariants:
 * 1) CreatorOVault and all delegatecall modules must have identical storage layout
 *    (slot/offset/label/type order).
 * 2) A layout change must not ship under the same MODULE_STORAGE_VERSION tag.
 *
 * Run:
 *   node scripts/check-ovault-module-storage-layout.mjs
 *   node scripts/check-ovault-module-storage-layout.mjs --write-snapshot
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const constantsFile = path.join(repoRoot, 'contracts/shared/vault/modules/OVaultModuleConstants.sol');
const snapshotFile = path.join(repoRoot, 'scripts/data/ovault-module-storage-layout.snapshot.json');

const contracts = [
  'contracts/creator/vault/CreatorOVault.sol:CreatorOVault',
  'contracts/creator/vault/modules/CreatorOVaultCoreModule.sol:CreatorOVaultCoreModule',
  'contracts/shared/vault/modules/OVaultStrategiesModule.sol:OVaultStrategiesModule',
  'contracts/shared/vault/modules/OVaultAdminModule.sol:OVaultAdminModule',
];

const writeSnapshot = process.argv.includes('--write-snapshot');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function info(msg) {
  console.log(`${CYAN}[..]${RESET}   ${msg}`);
}

function ok(msg) {
  console.log(`${GREEN}[ok]${RESET}   ${msg}`);
}

function fail(msg) {
  console.error(`${RED}[FAIL]${RESET} ${msg}`);
}

function normalizeType(type) {
  return String(type)
    .replace(/\)(\d+)_storage/g, ')_storage')
    .replace(/\)(\d+)(?=$|[,)])/g, ')');
}

function normalizeStorage(layoutJson) {
  const storage = Array.isArray(layoutJson?.storage) ? layoutJson.storage : [];
  return storage.map((entry) => ({
    label: String(entry.label),
    slot: String(entry.slot),
    offset: Number(entry.offset),
    type: normalizeType(entry.type),
  }));
}

function parseJsonFromForgeOutput(output) {
  const jsonStart = output.indexOf('{');
  if (jsonStart === -1) {
    throw new Error('forge inspect did not return JSON output');
  }
  return JSON.parse(output.slice(jsonStart));
}

function runForgeInspect(contractName, force = false) {
  const args = ['inspect'];
  if (force) args.push('--force');
  args.push('--json', contractName, 'storage-layout');
  return execFileSync('forge', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isMissingStorageLayoutError(error) {
  const stderr = String(error?.stderr ?? '');
  return stderr.includes('storage layout missing from artifact');
}

function readLayout(contractName) {
  try {
    const out = runForgeInspect(contractName, false);
    return normalizeStorage(parseJsonFromForgeOutput(out));
  } catch (error) {
    if (!isMissingStorageLayoutError(error)) {
      throw error;
    }
    info(`storage-layout metadata missing for ${contractName}; retrying with --force`);
    const forcedOut = runForgeInspect(contractName, true);
    return normalizeStorage(parseJsonFromForgeOutput(forcedOut));
  }
}

function firstMismatch(reference, candidate) {
  const n = Math.max(reference.length, candidate.length);
  for (let i = 0; i < n; i++) {
    const a = reference[i];
    const b = candidate[i];
    if (!a || !b) {
      return { index: i, reference: a ?? null, candidate: b ?? null };
    }
    if (a.label !== b.label || a.slot !== b.slot || a.offset !== b.offset || a.type !== b.type) {
      return { index: i, reference: a, candidate: b };
    }
  }
  return null;
}

function hashLayout(layout) {
  return createHash('sha256').update(JSON.stringify(layout)).digest('hex');
}

function readModuleStorageVersionTag() {
  const src = fs.readFileSync(constantsFile, 'utf8');
  const match = src.match(/MODULE_STORAGE_VERSION\s*=\s*keccak256\("([^"]+)"\)/);
  if (!match) {
    throw new Error(`Could not parse MODULE_STORAGE_VERSION tag from ${path.relative(repoRoot, constantsFile)}`);
  }
  return match[1];
}

function readSnapshot() {
  if (!fs.existsSync(snapshotFile)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
}

function writeSnapshotFile(payload) {
  fs.writeFileSync(snapshotFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main() {
  info('Checking CreatorOVault/module storage layout equivalence');

  const layouts = new Map();
  for (const contractName of contracts) {
    info(`Inspecting ${contractName}`);
    layouts.set(contractName, readLayout(contractName));
  }

  const referenceName = contracts[0];
  const referenceLayout = layouts.get(referenceName);
  if (!referenceLayout) {
    throw new Error(`Missing reference layout for ${referenceName}`);
  }

  for (const contractName of contracts.slice(1)) {
    const current = layouts.get(contractName);
    const mismatch = firstMismatch(referenceLayout, current);
    if (mismatch) {
      fail(`Storage layout mismatch between ${referenceName} and ${contractName} at index ${mismatch.index}`);
      fail(`Reference: ${JSON.stringify(mismatch.reference)}`);
      fail(`Candidate: ${JSON.stringify(mismatch.candidate)}`);
      process.exit(1);
    }
  }
  ok('CreatorOVault and all delegatecall modules share identical storage layout');

  const moduleStorageVersionTag = readModuleStorageVersionTag();
  const creatorOVaultLayoutHash = hashLayout(referenceLayout);

  if (writeSnapshot) {
    writeSnapshotFile({
      moduleStorageVersionTag,
      creatorOVaultLayoutHash,
      contracts,
    });
    ok(`Snapshot updated at ${path.relative(repoRoot, snapshotFile)}`);
    return;
  }

  const snapshot = readSnapshot();
  if (!snapshot) {
    fail(`Snapshot missing: ${path.relative(repoRoot, snapshotFile)}`);
    fail('Run `node scripts/check-ovault-module-storage-layout.mjs --write-snapshot` and commit the snapshot.');
    process.exit(1);
  }

  const snapshotTag = String(snapshot.moduleStorageVersionTag ?? '');
  const snapshotHash = String(snapshot.creatorOVaultLayoutHash ?? '');

  if (snapshotHash !== creatorOVaultLayoutHash) {
    if (snapshotTag === moduleStorageVersionTag) {
      fail(
        `Storage layout changed but MODULE_STORAGE_VERSION tag is unchanged ("${moduleStorageVersionTag}"). ` +
          'Bump the version tag and regenerate the snapshot.'
      );
    } else {
      fail(
        `Storage layout changed and MODULE_STORAGE_VERSION tag changed ` +
          `("${snapshotTag}" -> "${moduleStorageVersionTag}"). Regenerate snapshot to acknowledge the new layout.`
      );
    }
    fail('Run `node scripts/check-ovault-module-storage-layout.mjs --write-snapshot` and commit the result.');
    process.exit(1);
  }

  if (snapshotTag !== moduleStorageVersionTag) {
    fail(
      `MODULE_STORAGE_VERSION tag changed without a matching snapshot update ` +
        `("${snapshotTag}" -> "${moduleStorageVersionTag}").`
    );
    fail('Run `node scripts/check-ovault-module-storage-layout.mjs --write-snapshot` and commit the result.');
    process.exit(1);
  }

  ok(`Storage layout hash matches snapshot (${creatorOVaultLayoutHash.slice(0, 12)}...)`);
  ok(`MODULE_STORAGE_VERSION tag unchanged (${moduleStorageVersionTag})`);
  console.log(`\n${GREEN}ovault-module-storage-layout guard passed.${RESET}`);
}

main();
