#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';

const ALLOWED_STATUS = new Set(['current', 'needs-review', 'archived']);
const REQUIRED_FIELDS = ['audience', 'stage', 'owner', 'last_reviewed', 'status'];
const DEFAULT_STALE_DAYS = Number.parseInt(process.env.DOCS_STALE_DAYS || '90', 10);
const DOCS_SITE_ROOT = 'apps/docs-site/docs';

function normalizeAudience(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function parseIsoDate(value) {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const parsed = new Date(`${value.trim()}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

const files = fg.sync(['**/*.md', '**/*.mdx'], {
  cwd: DOCS_SITE_ROOT,
  dot: false,
}).sort();

const violations = [];
const canonicalTopicToFiles = new Map();
const now = new Date();
const staleCutoff = new Date(now.getTime() - DEFAULT_STALE_DAYS * 24 * 60 * 60 * 1000);
let checkedCount = 0;

for (const relPath of files) {
  const filePath = join(DOCS_SITE_ROOT, relPath);
  const raw = readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data || {};

  // Only enforce this policy on synced manual/public docs.
  if (data.generated === true || data.synced_from !== 'docs/') {
    continue;
  }

  checkedCount += 1;

  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null || String(data[field]).trim() === '') {
      violations.push(`${filePath}: missing required frontmatter field "${field}"`);
    }
  }

  const audience = normalizeAudience(data.audience);
  if (audience.length === 0) {
    violations.push(`${filePath}: audience must be a non-empty string or list`);
  }

  if (typeof data.stage !== 'string' || !data.stage.trim()) {
    violations.push(`${filePath}: stage must be a non-empty string`);
  }

  if (typeof data.owner !== 'string' || !data.owner.trim()) {
    violations.push(`${filePath}: owner must be a non-empty string`);
  }

  const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
  if (!ALLOWED_STATUS.has(status)) {
    violations.push(
      `${filePath}: status must be one of ${[...ALLOWED_STATUS].join(', ')}`,
    );
  }

  const reviewedAt = parseIsoDate(String(data.last_reviewed || ''));
  if (!reviewedAt) {
    violations.push(`${filePath}: last_reviewed must be YYYY-MM-DD`);
  } else if (status !== 'archived' && reviewedAt < staleCutoff) {
    violations.push(
      `${filePath}: stale last_reviewed=${data.last_reviewed} (older than ${DEFAULT_STALE_DAYS} days)`,
    );
  }

  const canonicalTopic = typeof data.canonical_topic === 'string'
    ? data.canonical_topic.trim().toLowerCase()
    : '';
  if (canonicalTopic && status !== 'archived') {
    const filesForTopic = canonicalTopicToFiles.get(canonicalTopic) ?? [];
    filesForTopic.push(filePath);
    canonicalTopicToFiles.set(canonicalTopic, filesForTopic);
  }
}

for (const [topic, topicFiles] of canonicalTopicToFiles.entries()) {
  if (topicFiles.length > 1) {
    violations.push(
      `canonical_topic "${topic}" is duplicated across active docs: ${topicFiles.join(', ')}`,
    );
  }
}

if (checkedCount === 0) {
  console.error('[docs] Hygiene policy check failed: no manual synced docs were evaluated.');
  process.exit(1);
}

if (violations.length > 0) {
  console.error(`[docs] Hygiene policy check failed (${violations.length} issue(s))`);
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(
  `[docs] Hygiene policy check passed for ${checkedCount} manual public docs (stale threshold ${DEFAULT_STALE_DAYS} days).`,
);
