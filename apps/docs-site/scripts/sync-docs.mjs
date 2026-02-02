/**
 * Docs Sync Script - Multi-Source Pipeline
 * 
 * Merges documentation from three sources:
 * 1. docs/ - Manual documentation (source of truth)
 * 2. docs/_generated/contracts/src/ - Solidity API docs from forge doc
 * 3. docs/_generated/frontend/ - TypeScript API docs from typedoc
 * 
 * Output: apps/docs-site/docs/ (never edit directly)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fg from 'fast-glob';
import matter from 'gray-matter';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEST_DIR = path.resolve(__dirname, '../docs');

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
  },
};

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
 * Normalize frontmatter for a markdown file
 */
function normalizeFrontmatter(content, relativePath, sidebarPosition, sourceType) {
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
  
  // Add source label for API docs
  if (sourceType === 'contracts' || sourceType === 'frontend') {
    parsed.data.generated = true;
  }
  
  return matter.stringify(parsed.content, parsed.data);
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
 * Get all markdown files from a source
 */
async function getSourceFiles(sourceDir, excludePatterns) {
  const files = await fg(['**/*.md', '**/*.mdx'], {
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
async function processSource(sourceKey) {
  const source = SOURCES[sourceKey];
  
  // Check if source exists
  if (!await sourceExists(source.dir)) {
    if (sourceKey !== 'manual') {
      stats.warnings.push(`${source.label}: Source directory not found (run generation first)`);
      console.log(`   ⚠️  ${source.label}: Not found (skipping)`);
    } else {
      stats.errors.push(`${source.label}: Source directory not found`);
      console.error(`   ✗ ${source.label}: Not found`);
    }
    return;
  }
  
  const files = await getSourceFiles(source.dir, source.exclude);
  
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
    const destRelative = source.destPrefix ? path.join(source.destPrefix, file) : file;
    const destPath = path.join(DEST_DIR, destRelative);
    
    try {
      // Read source file
      const content = await fs.readFile(sourcePath, 'utf-8');
      
      // Calculate sidebar position
      const dir = path.dirname(file);
      const filesInDir = filesByDir.get(dir);
      const position = filesInDir.indexOf(file) + 1;
      
      // Normalize frontmatter
      const processed = normalizeFrontmatter(content, file, position, sourceKey);
      
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
  
  // Clean destination
  console.log('\n🗑️  Cleaning destination...');
  await cleanDestination();
  
  // Process each source
  for (const sourceKey of Object.keys(SOURCES)) {
    await processSource(sourceKey);
  }
  
  // Create API index pages
  await createApiIndexPages();
  
  // Print summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('📊 SYNC SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Manual docs:     ${stats.bySource.manual}`);
  console.log(`   Contract API:    ${stats.bySource.contracts}`);
  console.log(`   Frontend API:    ${stats.bySource.frontend}`);
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
