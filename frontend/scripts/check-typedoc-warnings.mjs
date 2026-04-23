#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const budgetPath = path.resolve(process.cwd(), 'scripts/typedoc-warning-budget.json');
const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));

// Source-link pinning: honour DOCS_GITHUB_REF so release-branch docs builds
// resolve to the branch being documented, not main. Defaults to main for
// local runs and the standard CI path. Paired with the blob-ref rewrite in
// apps/docs-site/scripts/docs-refresh.mjs::normalizeGeneratedSourceLinks.
const docsGitRef = process.env.DOCS_GITHUB_REF || 'main';
const typedocArgs = [
  'exec',
  'typedoc',
  '--gitRevision',
  docsGitRef,
  '--sourceLinkTemplate',
  `https://github.com/wenakita/4626/blob/${docsGitRef}/{path}#L{line}`,
];

const typedocResult = spawnSync('pnpm', typedocArgs, {
  cwd: process.cwd(),
  env: process.env,
  encoding: 'utf8',
});

if (typedocResult.stdout) process.stdout.write(typedocResult.stdout);
if (typedocResult.stderr) process.stderr.write(typedocResult.stderr);

if (typedocResult.status !== 0) {
  process.exit(typedocResult.status ?? 1);
}

const output = `${typedocResult.stdout ?? ''}\n${typedocResult.stderr ?? ''}`;
const lines = output.split(/\r?\n/);

const summaryMatch = output.match(/\[warning\]\s+Found\s+(\d+)\s+errors\s+and\s+(\d+)\s+warnings/);
const summaryErrors = summaryMatch ? Number(summaryMatch[1]) : 0;
const summaryWarnings = summaryMatch ? Number(summaryMatch[2]) : null;

const counts = {
  totalWarningLines: 0,
  missingReference: 0,
  unusedParam: 0,
  intentionallyNotExportedHeaders: 0,
  intentionallyNotExportedEntries: 0,
  globNoMatch: 0,
  summary: 0,
  unknown: 0,
};

const unknownWarnings = new Set();
let inIntentionallyNotExportedBlock = false;

for (const line of lines) {
  if (line.startsWith('\t') && inIntentionallyNotExportedBlock) {
    if (line.trim().length > 0) {
      counts.intentionallyNotExportedEntries++;
    }
    continue;
  }

  if (inIntentionallyNotExportedBlock) {
    inIntentionallyNotExportedBlock = false;
  }

  if (!line.startsWith('[warning] ')) {
    continue;
  }

  counts.totalWarningLines++;
  const message = line.slice('[warning] '.length);

  if (/^Found \d+ errors and \d+ warnings$/.test(message)) {
    counts.summary++;
    continue;
  }

  if (/^The following symbols were marked as intentionally not exported/.test(message)) {
    counts.intentionallyNotExportedHeaders++;
    inIntentionallyNotExportedBlock = true;
    continue;
  }

  if (/has an @param with name .* which was not used$/.test(message)) {
    counts.unusedParam++;
    continue;
  }

  if (/is referenced by .* but not included in the documentation$/.test(message)) {
    counts.missingReference++;
    continue;
  }

  if (/^The glob .* did not match any files$/.test(message)) {
    counts.globNoMatch++;
    continue;
  }

  counts.unknown++;
  unknownWarnings.add(message);
}

const effectiveTotalWarnings = summaryWarnings ?? (counts.totalWarningLines - counts.summary);
const failures = [];

if (summaryErrors > 0) {
  failures.push(`TypeDoc reported ${summaryErrors} errors.`);
}

if (effectiveTotalWarnings > budget.maxTotalWarnings) {
  failures.push(
    `Total TypeDoc warnings increased (${effectiveTotalWarnings} > ${budget.maxTotalWarnings}).`,
  );
}

if (counts.missingReference > budget.maxMissingReferenceWarnings) {
  failures.push(
    `Missing-reference warnings increased (${counts.missingReference} > ${budget.maxMissingReferenceWarnings}).`,
  );
}

if (counts.unusedParam > budget.maxUnusedParamWarnings) {
  failures.push(`Unused @param warnings increased (${counts.unusedParam} > ${budget.maxUnusedParamWarnings}).`);
}

if (counts.intentionallyNotExportedEntries > budget.maxIntentionallyNotExportedEntries) {
  failures.push(
    `Intentionally-not-exported entries increased (${counts.intentionallyNotExportedEntries} > ${budget.maxIntentionallyNotExportedEntries}).`,
  );
}

if (counts.globNoMatch > 0) {
  failures.push('TypeDoc emitted glob-no-match warnings; fix typedoc entry globs before merging.');
}

if (!budget.allowUnknownWarningClasses && counts.unknown > 0) {
  const preview = Array.from(unknownWarnings).slice(0, 8);
  failures.push(
    `Found ${counts.unknown} unknown TypeDoc warning class(es).` +
      (preview.length > 0 ? ` Samples:\n- ${preview.join('\n- ')}` : ''),
  );
}

console.log(
  `[docs] TypeDoc warning guard summary: total=${effectiveTotalWarnings}, missingRef=${counts.missingReference}, unusedParam=${counts.unusedParam}, intentionallyNotExportedEntries=${counts.intentionallyNotExportedEntries}, unknown=${counts.unknown}`,
);

if (failures.length > 0) {
  console.error('[docs] TypeDoc warning guard failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[docs] TypeDoc warning guard passed.');
