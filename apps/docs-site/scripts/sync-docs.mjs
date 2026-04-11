/**
 * Docs Sync Script - Multi-Source Pipeline
 * 
 * Merges documentation from multiple first-party sources:
 * 1. docs/              - Manual documentation (source of truth)
 * 2. docs/_generated/   - Auto-generated API docs (forge doc, typedoc)
 * 3. cre/               - CRE automation workflows (README + docs)
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
const BRAND_DEST = path.join(STATIC_DIR, 'brand');

// Source directories
const SOURCES = {
  manual: {
    dir: path.join(REPO_ROOT, 'docs'),
    destPrefix: '',
    exclude: ['_generated/**', '_archive/**', 'archive/**', 'drafts/**', '_drafts/**'],
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
  cre: {
    dir: path.join(REPO_ROOT, 'cre'),
    destPrefix: 'operations/cre',
    exclude: [
      'node_modules/**', 'cre-workflows/**/node_modules/**',
      '**/*.ts', '**/*.js', '**/*.mjs', '**/*.json', '**/*.yaml', '**/*.yml',
      '**/*.env*', '**/patches/**', '**/dist/**', '**/.cre/**', '**/*.wasm',
    ],
    label: 'CRE workflows',
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
    cre: 0,
    frontendDocs: 0,
    rootMeta: 0,
    runtimeSkills: 0,
    serviceReadmes: 0,
  },
};

const GIT_DATE_PATHS = [
  'docs',
  'frontend/docs',
  'cre',
  'script/agent-runtime/skills',
  'README.md',
  'SECURITY.md',
  'deployments/README.md',
  'frontend/server/agent/eliza/README.md',
  'frontend/server/solana-provisioner/README.md',
  'docs/_generated/contracts',
  'docs/_generated/frontend',
];

let gitLastUpdatedByPath = new Map();

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
  
  // Fix LICENSE links (common in forge doc output)
  fixed = fixed.replace(/\]\(LICENSE\)/g, '](https://github.com/wenakita/4626/blob/main/LICENSE)');
  
  return fixed;
}

/**
 * Normalize frontmatter for a markdown file
 */
function normalizeFrontmatter(content, relativePath, sidebarPosition, sourceType, sourceMetadata) {
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
  if (sourceType === 'cre' || sourceType === 'frontendDocs' || sourceType === 'rootMeta' || sourceType === 'runtimeSkills' || sourceType === 'serviceReadmes') {
    if (sourceType === 'cre') parsed.data.synced_from = 'cre/';
    if (sourceType === 'frontendDocs') parsed.data.synced_from = 'frontend/';
    if (sourceType === 'rootMeta') parsed.data.synced_from = 'repo-root';
    if (sourceType === 'runtimeSkills') parsed.data.synced_from = 'script/agent-runtime/skills/';
    if (sourceType === 'serviceReadmes') parsed.data.synced_from = 'frontend/server/';
  }
  
  // Fix broken links in generated docs
  const fixedContent = fixGeneratedLinks(parsed.content, sourceType);
  
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
  cre: {
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
      const processed = normalizeFrontmatter(content, file, position, sourceKey, sourceMetadata);
      
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
  console.log(`   CRE workflows:   ${stats.bySource.cre}`);
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
