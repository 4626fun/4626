/**
 * Docs Sync Script - Multi-Source Pipeline
 * 
 * Merges documentation from multiple first-party sources:
 * 1. docs/              - Manual documentation (source of truth)
 * 2. docs/_generated/   - Auto-generated API docs (forge doc, typedoc)
 * 3. kpr/               - automation workflows (README + docs)
 * 4. frontend/docs/     - Frontend design docs & guides
 * 5. frontend/README.md - Frontend overview
 * 6. repo root docs      - Root README/security/deployment docs
 * 7. agent-runtime skills - Internal automation skills docs
 * 8. service readmes     - Runtime/provisioner operational READMEs
 * 
 * Output: apps/docs-site/docs/ (never edit directly)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'node:child_process';
import fg from 'fast-glob';
import matter from 'gray-matter';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const REPO_ROOT = process.env.DOCS_REPO_ROOT
  ? path.resolve(process.env.DOCS_REPO_ROOT)
  : path.resolve(__dirname, '../../..');
const DEST_DIR = path.resolve(__dirname, '../docs');
const STATIC_DIR = path.resolve(__dirname, '../static');
const BRAND_SOURCE = path.join(REPO_ROOT, 'frontend/public/brand');
const BRAND_ASSET_SOURCE = path.join(REPO_ROOT, 'frontend/public/assets');
const BRAND_DEST = path.join(STATIC_DIR, 'brand');

const DOCS_BRAND_CANONICAL_COPIES = [
  ['logo-mark.svg', 'logo.svg'],
  ['favicon.svg', 'favicon.svg'],
];

// Source directories
const SOURCES = {
  manual: {
    dir: path.join(REPO_ROOT, 'docs'),
    destPrefix: '',
    include: ['**/*.md', '**/*.mdx', '**/_category_.json'],
    exclude: ['_generated/**', '_archive/**', 'drafts/**', '_drafts/**', '_internal/**', 'plans/**'],
    label: 'Manual docs',
  },
  contracts: {
    dir: path.join(REPO_ROOT, 'docs/_generated/contracts/src'),
    destPrefix: 'api/contracts',
    exclude: [],
    label: 'Contract API (forge doc)',
  },
  frontend: {
    dir: path.join(REPO_ROOT, 'docs/_generated/frontend'),
    destPrefix: 'api/frontend',
    exclude: [],
    label: 'Frontend API (typedoc)',
  },
  kpr: {
    dir: path.join(REPO_ROOT, 'kpr'),
    destPrefix: 'operations/kpr',
    exclude: [
      'node_modules/**', 'kpr-workflows/**/node_modules/**',
      '**/*.ts', '**/*.js', '**/*.mjs', '**/*.json', '**/*.yaml', '**/*.yml',
      '**/*.env*', '**/patches/**', '**/dist/**', '**/.kpr/**', '**/*.wasm',
    ],
    label: 'Automation workflows',
  },
  frontendDocs: {
    dir: path.join(REPO_ROOT, 'frontend'),
    destPrefix: 'frontend',
    exclude: [
      'node_modules/**', 'dist/**', 'src/**', 'api/**', 'server/**',
      'abis/**', 'public/**', 'scripts/**', 'v4-subgraph/**',
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs', '**/*.json',
      '**/*.css', '**/*.html', '**/*.svg', '**/*.png', '**/*.env*',
      '**/patches/**',
    ],
    label: 'Frontend docs',
  },
  rootMeta: {
    dir: REPO_ROOT,
    destPrefix: 'reference/repo',
    include: ['README.md', 'SECURITY.md', 'deployments/README.md'],
    exclude: [],
    label: 'Repository docs',
  },
  runtimeSkills: {
    dir: path.join(REPO_ROOT, 'script/agent-runtime/skills'),
    destPrefix: 'operations/agent-runtime/skills',
    include: ['**/SKILL.md'],
    exclude: [],
    label: 'Agent runtime skills',
  },
  serviceReadmes: {
    dir: path.join(REPO_ROOT, 'frontend/server'),
    destPrefix: 'operations/services',
    include: ['agent/eliza/README.md', 'solana-provisioner/README.md'],
    exclude: [],
    label: 'Service READMEs',
  },
};

const STRICT_MODE = process.argv.includes('--strict');

const stats = {
  copied: 0,
  skipped: 0,
  errors: [],
  warnings: [],
  brokenLinks: [],
  bySource: {
    manual: 0,
    contracts: 0,
    frontend: 0,
    kpr: 0,
    frontendDocs: 0,
    rootMeta: 0,
    runtimeSkills: 0,
    serviceReadmes: 0,
  },
};

const GIT_DATE_PATHS = [
  'docs',
  'frontend/docs',
  'kpr',
  'script/agent-runtime/skills',
  'README.md',
  'SECURITY.md',
  'deployments/README.md',
  'frontend/server/agents/eliza/README.md',
  'frontend/server/solana-provisioner/README.md',
  'docs/_generated/contracts',
  'docs/_generated/frontend',
];

let gitLastUpdatedByPath = new Map();
// Source-link ref: honour DOCS_GITHUB_REF so release-branch docs builds resolve
// to the branch being documented, not hardcoded main. Mirrors the convention
// in apps/docs-site/scripts/docs-refresh.mjs and
// frontend/scripts/check-typedoc-warnings.mjs. See PR #338 / 4626-402.
const DOCS_GIT_REF = process.env.DOCS_GITHUB_REF || 'main';
const GITHUB_BLOB_BASE = `https://github.com/wenakita/4626/blob/${DOCS_GIT_REF}`;
const GITHUB_TREE_BASE = `https://github.com/wenakita/4626/tree/${DOCS_GIT_REF}`;
const MANUAL_ALLOWED_STATUS = new Set(['current', 'needs-review', 'archived']);
const MANUAL_DEFAULT_OWNER = process.env.DOCS_DEFAULT_OWNER || 'docs-team';

function normalizeRelPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function buildGitLastUpdatedIndex() {
  const map = new Map();
  try {
    const output = execFileSync(
      'git',
      ['log', '--format=__COMMIT__%cs', '--name-only', '--', ...GIT_DATE_PATHS],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 50 * 1024 * 1024,
      },
    );

    let currentDate = null;
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('__COMMIT__')) {
        currentDate = trimmed.replace('__COMMIT__', '');
        continue;
      }
      if (!currentDate) continue;
      const rel = normalizeRelPath(trimmed);
      if (!map.has(rel)) {
        map.set(rel, currentDate);
      }
    }
  } catch {
    // No-op: keep empty map when git metadata is unavailable.
  }
  return map;
}

/**
 * Returns true when targetPath stays inside baseDir.
 */
function isPathInside(baseDir, targetPath) {
  const rel = path.relative(path.resolve(baseDir), path.resolve(targetPath));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Convert filename to title case
 */
function filenameToTitle(filename) {
  return filename
    .replace(/\.mdx?$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract title from first H1 in content
 */
function extractH1Title(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Fix broken links in generated API docs
 * 
 * forge doc generates links like:
 *   /contracts/interfaces/IStrategy.sol/interface.IStrategy.md
 * 
 * But in Docusaurus, these pages are at:
 *   /api/contracts/contracts/interfaces/IStrategy.sol/interface.IStrategy
 * 
 * This function transforms links to work correctly.
 */
function fixGeneratedLinks(content, sourceType) {
  if (sourceType !== 'contracts') {
    return content;
  }
  
  let fixed = content;
  
  // Fix absolute links to /contracts/... -> relative links
  // These are broken because the actual path is /api/contracts/contracts/...
  // Convert to relative paths that work within the api/contracts section
  
  // Pattern: [text](/contracts/path/to/file.md) -> [text](../../../path/to/file)
  // We convert to relative because the depth varies
  fixed = fixed.replace(
    /\]\(\/contracts\/([^)]+)\.md\)/g,
    (match, linkPath) => {
      // Remove .md extension for Docusaurus
      return `](/api/contracts/contracts/${linkPath})`;
    }
  );
  
  // Fix directory links like /contracts/interfaces -> /api/contracts/contracts/interfaces
  fixed = fixed.replace(
    /\]\(\/contracts\/([^)]+)\)/g,
    (match, linkPath) => {
      // Skip if already fixed (has /api/ prefix) or is an anchor
      if (linkPath.startsWith('api/') || linkPath.startsWith('#')) {
        return match;
      }
      return `](/api/contracts/contracts/${linkPath})`;
    }
  );
  
  // Fix LICENSE links (common in forge doc output). Ref honours DOCS_GITHUB_REF.
  fixed = fixed.replace(/\]\(LICENSE\)/g, `](${GITHUB_BLOB_BASE}/LICENSE)`);
  
  return fixed;
}

function docsRouteFromRepoPath(repoPath) {
  const normalized = normalizeRelPath(repoPath)
    .replace(/^docs\//, '')
    .replace(/\.mdx?$/, '')
    .replace(/\/README$/i, '');
  if (!normalized || normalized.toLowerCase() === 'index') return '/';
  return `/${normalized}`;
}

function inferManualAudience(relativePath) {
  const rel = normalizeRelPath(relativePath);
  if (rel.startsWith('users/')) return ['users'];
  if (rel.startsWith('creators/')) return ['creators'];
  if (rel.startsWith('developers/')) return ['developers'];
  if (rel.startsWith('protocols/')) return ['protocols'];
  if (rel.startsWith('operators/')) return ['operators'];
  if (rel.startsWith('guides/')) return ['users', 'creators'];
  if (rel.startsWith('frontend/')) return ['developers', 'creators'];
  if (rel.startsWith('integrations/')) return ['protocols', 'developers'];
  if (rel.startsWith('contracts/')) return ['protocols', 'developers'];
  if (rel.startsWith('operations/automation/')) return ['operators', 'developers'];
  if (rel.startsWith('operations/deployment/')) return ['operators'];
  if (rel.startsWith('operations/services/')) return ['operators'];
  if (rel.startsWith('operations/')) return ['operators', 'developers'];
  if (rel.startsWith('reference/')) return ['developers', 'protocols', 'operators'];
  if (rel.startsWith('security/')) return ['developers', 'operators', 'protocols'];
  if (rel.startsWith('audits/')) return ['developers', 'operators', 'protocols'];
  if (rel.startsWith('legal/')) return ['users', 'creators', 'developers'];
  return ['developers'];
}

function inferManualStage(relativePath) {
  const rel = normalizeRelPath(relativePath);
  if (rel.startsWith('operations/')) return 'operate';
  if (rel.startsWith('security/') || rel.startsWith('audits/')) return 'assure';
  if (rel.startsWith('integrations/') || rel.startsWith('contracts/')) return 'integrate';
  return 'use';
}

function normalizeAudience(value, relativePath) {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean);
    if (normalized.length > 0) return normalized;
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim().toLowerCase()];
  }
  return inferManualAudience(relativePath);
}

function normalizeStatus(value) {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return MANUAL_ALLOWED_STATUS.has(candidate) ? candidate : 'current';
}

function ensureManualMetadata(frontmatter, relativePath, sourceMetadata) {
  frontmatter.synced_from = 'docs/';
  frontmatter.audience = normalizeAudience(frontmatter.audience, relativePath);
  if (!frontmatter.stage) {
    frontmatter.stage = inferManualStage(relativePath);
  }
  if (!frontmatter.owner) {
    frontmatter.owner = MANUAL_DEFAULT_OWNER;
  }
  const reviewDate =
    frontmatter.last_reviewed ||
    frontmatter.last_updated ||
    sourceMetadata?.lastUpdated ||
    new Date().toISOString().slice(0, 10);
  frontmatter.last_reviewed = String(reviewDate).slice(0, 10);
  frontmatter.status = normalizeStatus(frontmatter.status);
}

function maybeRewriteRepoLink(rawTarget, sourcePath) {
  const [targetPath, hash = ''] = String(rawTarget).split('#', 2);
  if (
    !targetPath ||
    targetPath.startsWith('http') ||
    targetPath.startsWith('mailto:') ||
    targetPath.startsWith('#') ||
    targetPath.startsWith('/')
  ) {
    return null;
  }

  const resolved = path.resolve(path.dirname(sourcePath), targetPath);
  if (!isPathInside(REPO_ROOT, resolved)) {
    return null;
  }

  const repoRel = normalizeRelPath(path.relative(REPO_ROOT, resolved));

  if (repoRel.startsWith('docs/')) {
    return `${docsRouteFromRepoPath(repoRel)}${hash ? `#${hash}` : ''}`;
  }

  if (repoRel.startsWith('frontend/docs/')) {
    const frontendDocPath = repoRel
      .replace(/^frontend\//, '')
      .replace(/\.mdx?$/, '')
      .replace(/\/README$/i, '');
    return `/frontend/${frontendDocPath}${hash ? `#${hash}` : ''}`;
  }

  const isLikelyFile = path.extname(repoRel) !== '';
  const base = isLikelyFile ? GITHUB_BLOB_BASE : GITHUB_TREE_BASE;
  return `${base}/${repoRel}${hash ? `#${hash}` : ''}`;
}

function rewriteRepoRelativeLinks(content, sourcePath) {
  return content.replace(/\]\(([^)]+)\)/g, (match, target) => {
    const rewritten = maybeRewriteRepoLink(target, sourcePath);
    return rewritten ? `](${rewritten})` : match;
  });
}

/**
 * Normalize frontmatter for a markdown file
 */
function normalizeFrontmatter(content, relativePath, sidebarPosition, sourceType, sourceMetadata, sourcePath) {
  const parsed = matter(content);
  const filename = path.basename(relativePath);
  
  // Derive title if missing
  if (!parsed.data.title) {
    const h1Title = extractH1Title(parsed.content);
    parsed.data.title = h1Title || filenameToTitle(filename);
  }
  
  // Add sidebar_position if missing
  if (parsed.data.sidebar_position === undefined) {
    parsed.data.sidebar_position = sidebarPosition;
  }

  if (sourceMetadata?.lastUpdated) {
    parsed.data.last_updated = sourceMetadata.lastUpdated;
  }
  
  // Add source label for API docs
  if (sourceType === 'contracts' || sourceType === 'frontend') {
    parsed.data.generated = true;
  }

  // Mark workspace-sourced docs
  if (sourceType === 'manual') {
    ensureManualMetadata(parsed.data, relativePath, sourceMetadata);
  } else if (sourceType === 'kpr' || sourceType === 'frontendDocs' || sourceType === 'rootMeta' || sourceType === 'runtimeSkills' || sourceType === 'serviceReadmes') {
    if (sourceType === 'kpr') parsed.data.synced_from = 'kpr/';
    if (sourceType === 'frontendDocs') parsed.data.synced_from = 'frontend/';
    if (sourceType === 'rootMeta') parsed.data.synced_from = 'repo-root';
    if (sourceType === 'runtimeSkills') parsed.data.synced_from = 'script/agent-runtime/skills/';
    if (sourceType === 'serviceReadmes') parsed.data.synced_from = 'frontend/server/';
  }
  
  // Fix broken links in generated docs
  let fixedContent = fixGeneratedLinks(parsed.content, sourceType);

  // For docs copied from repo sources, rewrite filesystem-relative links to
  // either docs-site routes or GitHub blob/tree URLs.
  if (!['contracts', 'frontend'].includes(sourceType)) {
    fixedContent = rewriteRepoRelativeLinks(fixedContent, sourcePath);
  }
  
  return matter.stringify(fixedContent, parsed.data);
}

/**
 * Clean destination directory
 */
async function cleanDestination() {
  try {
    await fs.rm(DEST_DIR, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
  await fs.mkdir(DEST_DIR, { recursive: true });
}

/**
 * Check if source directory exists
 */
async function sourceExists(sourceDir) {
  try {
    await fs.access(sourceDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rename map for workspace-sourced docs.
 * Keys are sourceKey, values are maps of original filename -> destination filename.
 */
const RENAME_MAP = {
  kpr: {
    'README.md': 'index.md',
  },
  frontendDocs: {
    'README.md': 'overview.md',
  },
  rootMeta: {
    'README.md': 'index.md',
    'SECURITY.md': 'security.md',
  },
  runtimeSkills: {
    'SKILL.md': 'index.md',
  },
  serviceReadmes: {
    'README.md': 'index.md',
  },
};

/**
 * Apply rename rules for a file path within a given source
 */
function applyRename(file, sourceKey) {
  const renames = RENAME_MAP[sourceKey];
  if (!renames) return file;

  const basename = path.basename(file);
  const dir = path.dirname(file);
  const newName = renames[basename];
  if (newName) {
    return dir === '.' ? newName : path.join(dir, newName);
  }
  return file;
}

/**
 * Get all markdown files from a source
 */
async function getSourceFiles(sourceDir, includePatterns, excludePatterns) {
  const files = await fg(includePatterns && includePatterns.length > 0 ? includePatterns : ['**/*.md', '**/*.mdx'], {
    cwd: sourceDir,
    ignore: [
      ...excludePatterns,
      '**/node_modules/**',
      '**/.git/**',
      '**/.*',
    ],
    dot: false,
  });
  return files.sort();
}

/**
 * Process files from a single source
 */
async function processSource(sourceKey, options = {}) {
  const { missingManualAsWarning = false } = options;
  const source = SOURCES[sourceKey];
  
  // Check if source exists
  if (!await sourceExists(source.dir)) {
    if (sourceKey !== 'manual') {
      stats.warnings.push(`${source.label}: Source directory not found (run generation first)`);
      console.log(`   ⚠️  ${source.label}: Not found (skipping)`);
    } else {
      if (missingManualAsWarning) {
        stats.warnings.push(`${source.label}: Source directory not found (using bundled docs snapshot)`);
        console.log(`   ⚠️  ${source.label}: Not found (using bundled docs snapshot)`);
      } else {
        stats.errors.push(`${source.label}: Source directory not found`);
        console.error(`   ✗ ${source.label}: Not found`);
      }
    }
    return;
  }
  
  const files = await getSourceFiles(source.dir, source.include, source.exclude);
  
  if (files.length === 0) {
    stats.warnings.push(`${source.label}: No markdown files found`);
    console.log(`   ⚠️  ${source.label}: No files found`);
    return;
  }
  
  console.log(`\n📁 ${source.label} (${files.length} files)`);
  
  // Group files by directory for sidebar ordering
  const filesByDir = new Map();
  for (const file of files) {
    const dir = path.dirname(file);
    if (!filesByDir.has(dir)) {
      filesByDir.set(dir, []);
    }
    filesByDir.get(dir).push(file);
  }
  
  // Process each file
  for (const file of files) {
    const sourcePath = path.join(source.dir, file);
    const renamedFile = applyRename(file, sourceKey);
    const destRelative = source.destPrefix ? path.join(source.destPrefix, renamedFile) : renamedFile;
    const destPath = path.join(DEST_DIR, destRelative);
    
    try {
      if (file.endsWith('_category_.json')) {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(sourcePath, destPath);
        stats.copied++;
        stats.bySource[sourceKey]++;
        if (sourceKey === 'manual') {
          console.log(`   ✓ ${file}`);
        }
        continue;
      }

      // Read source file
      const content = await fs.readFile(sourcePath, 'utf-8');
      
      // Calculate sidebar position
      const dir = path.dirname(file);
      const filesInDir = filesByDir.get(dir);
      const position = filesInDir.indexOf(file) + 1;
      const relSourcePath = normalizeRelPath(path.relative(REPO_ROOT, sourcePath));
      const sourceMetadata = {
        lastUpdated: gitLastUpdatedByPath.get(relSourcePath) ?? null,
      };
      
      // Normalize frontmatter
      const processed = normalizeFrontmatter(content, file, position, sourceKey, sourceMetadata, sourcePath);
      
      // Create destination directory
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      
      // Write processed file
      await fs.writeFile(destPath, processed);
      
      stats.copied++;
      stats.bySource[sourceKey]++;
      
      // Log (abbreviated for API docs)
      if (sourceKey === 'manual') {
        console.log(`   ✓ ${file}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stats.errors.push(`${file}: ${message}`);
      console.error(`   ✗ ${file}: ${message}`);
    }
  }
  
  // Summary for API docs
  if (sourceKey !== 'manual') {
    console.log(`   ✓ ${stats.bySource[sourceKey]} files processed`);
  }
}

/**
 * Sync brand assets from frontend/public/brand to static/brand
 */
async function syncBrandAssets() {
  console.log('\n🎨 Syncing brand assets...');
  
  // Check if source exists
  if (!await sourceExists(BRAND_SOURCE)) {
    stats.warnings.push('Brand assets: Source directory not found');
    console.log('   ⚠️  Brand source not found (skipping)');
    return;
  }
  
  // Clean and recreate destination
  try {
    await fs.rm(BRAND_DEST, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
  await fs.mkdir(BRAND_DEST, { recursive: true });
  
  // Get all files in brand directory
  const files = await fg(['**/*'], {
    cwd: BRAND_SOURCE,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
  });
  
  if (files.length === 0) {
    stats.warnings.push('Brand assets: No files found');
    console.log('   ⚠️  No brand files found');
    return;
  }
  
  // Copy each file
  let copied = 0;
  const copiedFiles = [];
  for (const file of files) {
    const sourcePath = path.resolve(BRAND_SOURCE, file);
    const destPath = path.resolve(BRAND_DEST, file);
    
    try {
      if (!isPathInside(BRAND_SOURCE, sourcePath)) {
        stats.warnings.push(`Brand asset ${file}: skipped (source path escapes brand root)`);
        continue;
      }
      if (!isPathInside(BRAND_DEST, destPath)) {
        stats.warnings.push(`Brand asset ${file}: skipped (destination path escapes brand output root)`);
        continue;
      }

      const sourceStat = await fs.lstat(sourcePath);
      if (sourceStat.isSymbolicLink()) {
        stats.warnings.push(`Brand asset ${file}: skipped symbolic link`);
        continue;
      }
      if (!sourceStat.isFile()) {
        continue;
      }

      const realSourcePath = await fs.realpath(sourcePath);
      if (!isPathInside(BRAND_SOURCE, realSourcePath)) {
        stats.warnings.push(`Brand asset ${file}: skipped symlink traversal target outside brand root`);
        continue;
      }

      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(realSourcePath, destPath);
      copied++;
      copiedFiles.push(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stats.warnings.push(`Brand asset ${file}: ${message}`);
    }
  }
  
  console.log(`   ✓ ${copied} brand assets copied`);
  for (const file of copiedFiles) {
    console.log(`     - ${file}`);
  }

  for (const [assetFile, brandFile] of DOCS_BRAND_CANONICAL_COPIES) {
    const sourcePath = path.resolve(BRAND_ASSET_SOURCE, assetFile);
    const destPath = path.resolve(BRAND_DEST, brandFile);

    if (!(await sourceExists(sourcePath))) {
      stats.warnings.push(`Brand assets: missing canonical source ${assetFile}`);
      continue;
    }

    try {
      await fs.mkdir(BRAND_DEST, { recursive: true });
      await fs.copyFile(sourcePath, destPath);
      console.log(`     - ${brandFile} (from assets/${assetFile})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stats.warnings.push(`Brand asset ${brandFile}: ${message}`);
    }
  }
}

/**
 * Create API index pages
 */
async function createApiIndexPages() {
  // Create api/index.md
  const apiIndexContent = `---
title: API Reference
sidebar_position: 100
---

# API Reference

Auto-generated API documentation from source code.

## Contract API

Solidity smart contract documentation generated from NatSpec comments using \`forge doc\`.

- [View Contract API](/api/contracts/)

## Frontend API

TypeScript API documentation generated from TSDoc comments using TypeDoc.

- [View Frontend API](/api/frontend/)

---

*This documentation is auto-generated. Do not edit directly.*
`;

  const apiDir = path.join(DEST_DIR, 'api');
  await fs.mkdir(apiDir, { recursive: true });
  await fs.writeFile(path.join(apiDir, 'index.md'), apiIndexContent);
  console.log('\n📄 Created api/index.md');
}

/**
 * Main sync function
 */
async function sync() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('📚 Multi-Source Documentation Sync');
  console.log('════════════════════════════════════════════════════════════');

  gitLastUpdatedByPath = buildGitLastUpdatedIndex();
  
  const manualSourceAvailable = await sourceExists(SOURCES.manual.dir);
  const bundledSnapshotAvailable = await sourceExists(path.join(DEST_DIR, 'index.md'));
  const preserveBundledSnapshot = !manualSourceAvailable && bundledSnapshotAvailable;

  // Clean destination unless we are in an isolated build that only has docs-site.
  if (preserveBundledSnapshot) {
    console.log('\n📦 Preserving bundled docs snapshot (repo-root docs unavailable in this build context).');
  } else {
    console.log('\n🗑️  Cleaning destination...');
    await cleanDestination();
  }
  
  // Process each source
  for (const sourceKey of Object.keys(SOURCES)) {
    await processSource(sourceKey, { missingManualAsWarning: preserveBundledSnapshot });
  }
  
  // Create API index pages
  await createApiIndexPages();
  
  // Sync brand assets
  await syncBrandAssets();
  
  // Print summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('📊 SYNC SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Manual docs:     ${stats.bySource.manual}`);
  console.log(`   Contract API:    ${stats.bySource.contracts}`);
  console.log(`   Frontend API:    ${stats.bySource.frontend}`);
  console.log(`   Automation flows: ${stats.bySource.kpr}`);
  console.log(`   Frontend docs:   ${stats.bySource.frontendDocs}`);
  console.log(`   Repository docs: ${stats.bySource.rootMeta}`);
  console.log(`   Runtime skills:  ${stats.bySource.runtimeSkills}`);
  console.log(`   Service READMEs: ${stats.bySource.serviceReadmes}`);
  console.log(`   ─────────────────────────`);
  console.log(`   Total copied:    ${stats.copied}`);
  console.log(`   Errors:          ${stats.errors.length}`);
  console.log(`   Warnings:        ${stats.warnings.length}`);
  console.log('════════════════════════════════════════════════════════════\n');
  
  // Report warnings
  if (stats.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const warning of stats.warnings) {
      console.log(`   - ${warning}`);
    }
    console.log('');
  }
  
  // Report errors
  if (stats.errors.length > 0) {
    console.log('❌ Errors:');
    for (const error of stats.errors) {
      console.log(`   - ${error}`);
    }
    console.log('');
  }
  
  // Handle strict mode
  if (STRICT_MODE && stats.errors.length > 0) {
    console.error('❌ Strict mode: Failing due to errors\n');
    process.exit(1);
  }
  
  if (stats.errors.length === 0) {
    console.log('✅ Sync completed successfully.\n');
  } else {
    console.log('⚠️  Sync completed with errors.\n');
  }
}

// Run
sync().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
