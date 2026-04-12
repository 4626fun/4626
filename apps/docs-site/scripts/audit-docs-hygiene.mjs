#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const outputJson = args.has('--json');
const strict = args.has('--strict');
const strictStale = args.has('--strict-stale');

const THIRD_PARTY_PREFIXES = [
  'lib/',
  'node_modules/',
  'target/',
  'out/',
  'cache/',
  'broadcast/',
  'design/audit-source-snapshots/',
  'docs/_generated/',
  'apps/docs-site/docs/',
];

const EXPLICIT_OUT_OF_SCOPE = [
  '.cursor/skills/**',
  'AGENTS.md',
  '.github/pull_request_template.md',
  'apps/docs-site/README.md',
  'design/base-brand-archive/README.md',
  'frontend/public/protocols/README.md',
];

const DEFAULT_STALE_DAYS = 120;
const MIN_PARAGRAPH_WORDS = 22;
const MIN_PARAGRAPH_CHARS = 180;
const IGNORE_DUPLICATE_SNIPPETS = [
  'this documentation is auto-generated',
  'do not edit directly',
  'built with mintlify',
];

function matchesPattern(filePath, pattern) {
  if (pattern.endsWith('/**')) return filePath.startsWith(pattern.slice(0, -3));
  return filePath === pattern;
}

function shouldIgnoreFile(filePath) {
  if (THIRD_PARTY_PREFIXES.some((prefix) => filePath.startsWith(prefix))) return true;
  if (EXPLICIT_OUT_OF_SCOPE.some((pattern) => matchesPattern(filePath, pattern))) return true;
  return false;
}

function gitLines(commandArgs) {
  const output = execFileSync('git', commandArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 50 * 1024 * 1024,
  }).trim();
  return output ? output.split('\n').filter(Boolean) : [];
}

function buildGitLastUpdatedIndex() {
  const output = execFileSync('git', ['log', '--format=__COMMIT__%cs', '--name-only'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 100 * 1024 * 1024,
  });
  const map = new Map();
  let date = null;
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('__COMMIT__')) {
      date = trimmed.replace('__COMMIT__', '');
      continue;
    }
    if (!date || map.has(trimmed)) continue;
    map.set(trimmed, date);
  }
  return map;
}

function stripFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return markdown;
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return markdown;
  return markdown.slice(end + 5);
}

function stripCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '\n');
}

function normalizeParagraph(paragraph) {
  return paragraph
    .replace(/\[[^\]]+]\([^)]+\)/g, '$1')
    .replace(/[>#*_`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isDuplicateCandidate(paragraph) {
  if (paragraph.length < MIN_PARAGRAPH_CHARS) return false;
  const words = paragraph.split(/\s+/).filter(Boolean).length;
  if (words < MIN_PARAGRAPH_WORDS) return false;
  if (IGNORE_DUPLICATE_SNIPPETS.some((snippet) => paragraph.includes(snippet))) return false;
  return true;
}

function parseDateYyyyMmDd(value) {
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const trackedMarkdown = gitLines(['ls-files']).filter((file) => file.endsWith('.md') || file.endsWith('.mdx'));
const files = trackedMarkdown.filter((file) => !shouldIgnoreFile(file));
const lastUpdated = buildGitLastUpdatedIndex();

const paragraphToFiles = new Map();
const staleFiles = [];
let evaluatedFiles = 0;

const now = new Date();
const staleCutoff = new Date(now.getTime() - DEFAULT_STALE_DAYS * 24 * 60 * 60 * 1000);

for (const filePath of files) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      continue;
    }
    throw error;
  }
  evaluatedFiles += 1;
  const text = stripCodeBlocks(stripFrontmatter(raw));
  const paragraphs = text
    .split(/\n\s*\n/g)
    .map((p) => normalizeParagraph(p))
    .filter(Boolean)
    .filter(isDuplicateCandidate);

  for (const paragraph of paragraphs) {
    const arr = paragraphToFiles.get(paragraph) ?? [];
    arr.push(filePath);
    paragraphToFiles.set(paragraph, arr);
  }

  const updated = lastUpdated.get(filePath);
  const parsed = updated ? parseDateYyyyMmDd(updated) : null;
  if (parsed && parsed < staleCutoff) {
    staleFiles.push({ file: filePath, lastUpdated: updated });
  }
}

const duplicateParagraphs = [...paragraphToFiles.entries()]
  .filter(([, fileList]) => new Set(fileList).size >= 2)
  .map(([paragraph, fileList]) => ({
    paragraph,
    files: [...new Set(fileList)].sort(),
    count: new Set(fileList).size,
  }))
  .sort((a, b) => b.count - a.count || b.paragraph.length - a.paragraph.length);

staleFiles.sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated));

const result = {
  evaluatedFiles,
  staleThresholdDays: DEFAULT_STALE_DAYS,
  duplicateParagraphGroupCount: duplicateParagraphs.length,
  staleFileCount: staleFiles.length,
  topDuplicateParagraphGroups: duplicateParagraphs.slice(0, 20),
  topStaleFiles: staleFiles.slice(0, 50),
};

if (outputJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`[docs] Evaluated files: ${result.evaluatedFiles}`);
  console.log(`[docs] Duplicate paragraph groups (2+ files): ${result.duplicateParagraphGroupCount}`);
  console.log(`[docs] Stale docs (> ${DEFAULT_STALE_DAYS} days): ${result.staleFileCount}`);
  if (result.topDuplicateParagraphGroups.length > 0) {
    console.log('\n[docs] Top duplicate paragraph groups:');
    for (const group of result.topDuplicateParagraphGroups.slice(0, 10)) {
      console.log(`- ${group.count} files`);
      for (const file of group.files.slice(0, 5)) {
        console.log(`  • ${file}`);
      }
      if (group.files.length > 5) {
        console.log(`  • ... +${group.files.length - 5} more`);
      }
    }
  }
  if (result.topStaleFiles.length > 0) {
    console.log('\n[docs] Top stale files:');
    for (const item of result.topStaleFiles.slice(0, 20)) {
      console.log(`- ${item.lastUpdated} ${item.file}`);
    }
  }
}

if (strictStale && result.staleFileCount > 0) {
  process.exit(1);
}

if (strict && (result.duplicateParagraphGroupCount > 0 || result.staleFileCount > 0)) {
  process.exit(1);
}
