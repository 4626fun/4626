#!/usr/bin/env node

// Repo-wide regression guard for 4626-402.
//
// The docs pipeline has two classes of source-link regression we've paid for:
//
//   1. Typedoc / tsconfig configs that hardcode `gitRevision` or a
//      `blob/<ref>/` segment in `sourceLinkTemplate`. This silently overrides
//      the CLI injection in frontend/scripts/check-typedoc-warnings.mjs, so
//      release-branch docs builds resolve back to main.
//
//   2. Docs-pipeline scripts (apps/docs-site/scripts/**, frontend/scripts/**,
//      scripts/**) that hardcode `github.com/wenakita/4626/blob/main/...` or
//      `...blob/<SHA>/...` literals instead of reading DOCS_GITHUB_REF. Same
//      drift surface, different file type.
//
// This guard scans both surfaces across the whole repo and exits non-zero on
// any hit. It replaces the narrower frontend-only guard added in PR #338.
//
// Scope:
//   - JSON configs:  typedoc.json, typedoc*.json, tsconfig*.json under any path
//     except ignored roots.
//   - Script files:  *.ts, *.mjs, *.js under scripts/, apps/docs-site/scripts/,
//     and frontend/scripts/ (the three places where docs pipeline code lives).
//
// Ignored roots (not scanned):
//   node_modules, lib/, .git/, out/, docs/_generated/, apps/docs-site/docs/,
//   design/audit-source-snapshots/, and the guard file itself.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');

const IGNORED_DIRS = new Set([
  'node_modules',
  'lib',
  '.git',
  'out',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
]);

// Full relative paths (from repo root) that are entirely skipped.
const IGNORED_PATH_PREFIXES = [
  'docs/_generated/',
  'apps/docs-site/docs/',
  'apps/docs-site/.docusaurus/',
  'apps/docs-site/build/',
  'design/audit-source-snapshots/',
];

// The guard file itself references the forbidden patterns as string literals
// for regex construction and messaging. Same for test fixtures that
// intentionally feed hardcoded main/SHA URLs into the rewriter as inputs to
// assert the rewriter converts them to DOCS_GITHUB_REF.
const SELF_REFERENTIAL_ALLOWLIST = new Set([
  'scripts/check-docs-source-link-pin.mjs',
  'apps/docs-site/scripts/__tests__/source-link-ref-e2e.test.mjs',
]);

const SCRIPT_SCAN_ROOTS = [
  'scripts',
  'apps/docs-site/scripts',
  'frontend/scripts',
];

const SCRIPT_EXTENSIONS = new Set(['.ts', '.mjs', '.js', '.cjs']);

const failures = [];

function shouldIgnorePath(relPath) {
  const segments = relPath.split('/');
  if (segments.some((seg) => IGNORED_DIRS.has(seg))) return true;
  for (const prefix of IGNORED_PATH_PREFIXES) {
    if (relPath.startsWith(prefix)) return true;
  }
  return false;
}

function* walk(dir, { filter }) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
    if (shouldIgnorePath(rel)) continue;
    if (entry.isDirectory()) {
      yield* walk(abs, { filter });
    } else if (entry.isFile() && filter(rel, entry.name)) {
      yield { abs, rel };
    }
  }
}

// -------- JSON config scanner (typedoc.json, tsconfig*.json) --------

function isTypedocOrTsconfig(rel, name) {
  if (name === 'typedoc.json') return true;
  if (/^typedoc.*\.json$/.test(name)) return true;
  if (/^tsconfig.*\.json$/.test(name)) return true;
  return false;
}

// String-aware JSONC comment stripper. We cannot use a naive regex because
// tsconfig path aliases like "@/*" / "../src/*" contain literal "/*" inside
// quoted strings; stripping those mangles JSON and causes a silent blind spot
// (JSON.parse fails → catch → file skipped → guard never scans it).
//
// Walks the input character-by-character tracking three states: in-string,
// in-line-comment, in-block-comment. Preserves newlines so line-counting
// tooling downstream still works.
function stripJsoncComments(input) {
  let out = '';
  let i = 0;
  const n = input.length;
  let inString = false;
  let stringQuote = '';
  let inLineComment = false;
  let inBlockComment = false;

  while (i < n) {
    const ch = input[i];
    const next = i + 1 < n ? input[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        if (ch === '\n') out += ch; // preserve line count
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        // Copy the escaped char verbatim; do not interpret it as a comment
        // starter.
        out += input[i + 1];
        i += 2;
        continue;
      }
      if (ch === stringQuote) {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function scanJsonConfig({ abs, rel }) {
  let raw;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch (err) {
    failures.push(`  - ${rel}: cannot read (${err?.message ?? err})`);
    return;
  }

  // tsconfig files often have comments; strip // and /* */ respecting string
  // literals so path aliases like "@/*" don't mangle JSON and cause a silent
  // parse-fail blind spot.
  const stripped = stripJsoncComments(raw);

  let config;
  try {
    config = JSON.parse(stripped);
  } catch (err) {
    // If we got here after comment-stripping, the file is genuinely malformed
    // JSON. Surface this as a failure rather than silently skipping — a file
    // we can't scan is a file where a forbidden value could hide.
    failures.push(
      `  - ${rel}: cannot parse as JSON after comment strip ` +
        `(${err?.message ?? err}). Fix the JSON syntax so the guard can ` +
        `scan it, or add it to an explicit skip list with justification.`,
    );
    return;
  }

  // Walk the config object looking for forbidden keys anywhere in the tree.
  // Typedoc has extensions/plugins that can nest options, so depth-unrestricted
  // scan is the safe choice.
  const visit = (node, keyPath) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${keyPath}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      const here = keyPath ? `${keyPath}.${k}` : k;
      if (k === 'gitRevision') {
        failures.push(
          `  - ${rel}: "${here}" is set (value: ${JSON.stringify(v)}). ` +
            `Remove it; DOCS_GITHUB_REF must be the single source of truth ` +
            `(injected at typedoc CLI time, see frontend/scripts/check-typedoc-warnings.mjs).`,
        );
      } else if (k === 'sourceLinkTemplate' && typeof v === 'string') {
        const hardcoded = v.match(/\/blob\/([^/]+)\//);
        if (hardcoded) {
          failures.push(
            `  - ${rel}: "${here}" hardcodes ref "${hardcoded[1]}" in the blob path ` +
              `(value: ${JSON.stringify(v)}). Remove the field so DOCS_GITHUB_REF is ` +
              `the single source of truth.`,
          );
        }
      }
      visit(v, here);
    }
  };
  visit(config, '');
}

// -------- Script scanner (apps/docs-site/scripts, frontend/scripts, scripts) --------

const BLOB_LITERAL_RE = /https?:\/\/github\.com\/wenakita\/4626\/blob\/(main|[0-9a-f]{7,40})\//g;

function scanScript({ abs, rel }) {
  if (SELF_REFERENTIAL_ALLOWLIST.has(rel)) return;

  let raw;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch {
    return;
  }

  // Find each literal occurrence and report with line number.
  const lines = raw.split('\n');
  lines.forEach((line, idx) => {
    // Skip lines that are pure comments acknowledging the anti-pattern. The
    // heuristic: a `blob/main/` or `blob/<sha>/` inside a comment block that
    // names DOCS_GITHUB_REF in the same or adjacent lines is documentation,
    // not a live URL constant. But cheapest filter first — if the line has
    // DOCS_GITHUB_REF anywhere, it's doing template construction and we
    // trust it. Our own fixed scripts embed the pattern in template literals
    // as `blob/${DOCS_GIT_REF}/...`, which won't match the literal regex.
    if (line.includes('DOCS_GITHUB_REF')) return;
    // Reset regex state per line (global flag).
    BLOB_LITERAL_RE.lastIndex = 0;
    const matches = [...line.matchAll(BLOB_LITERAL_RE)];
    if (matches.length === 0) return;
    for (const m of matches) {
      failures.push(
        `  - ${rel}:${idx + 1}: hardcoded "blob/${m[1]}/" literal. ` +
          `Construct the URL from DOCS_GITHUB_REF instead (see ` +
          `apps/docs-site/scripts/sync-docs.mjs::DOCS_GIT_REF for the pattern).`,
      );
    }
  });
}

// -------- Run --------

for (const { abs, rel } of walk(REPO_ROOT, { filter: isTypedocOrTsconfig })) {
  scanJsonConfig({ abs, rel });
}

for (const scriptRoot of SCRIPT_SCAN_ROOTS) {
  const absRoot = path.join(REPO_ROOT, scriptRoot);
  try {
    statSync(absRoot);
  } catch {
    continue;
  }
  for (const { abs, rel } of walk(absRoot, {
    filter: (_rel, name) => SCRIPT_EXTENSIONS.has(path.extname(name)),
  })) {
    scanScript({ abs, rel });
  }
}

if (failures.length > 0) {
  console.error('[docs] Docs source-link pin guard failed.\n');
  for (const line of failures) console.error(line);
  console.error(
    '\nBackground: 4626-402 / PR #338. Docs builds must let DOCS_GITHUB_REF ' +
      'drive the source-link ref end-to-end; hardcoded refs silently override ' +
      'that on non-main docs builds (e.g. release-branch regeneration).',
  );
  process.exit(1);
}

console.log(
  '[docs] Docs source-link pin guard passed — no hardcoded refs in typedoc / tsconfig configs or pipeline scripts.',
);
