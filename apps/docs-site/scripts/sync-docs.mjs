/**
 * Docs Sync Script
 * 
 * Copies and curates docs from 4626/docs/ -> apps/docs-site/docs/
 * 
 * Documentation Model:
 * - Source of truth: 4626/docs/ (canonical, human-written)
 * - Generated output: apps/docs-site/docs/ (never edit directly)
 * 
 * Scope Rules:
 * - Only reads from 4626/docs/
 * - Never reads from contracts/ or frontend/ directly
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
const SOURCE_DIR = path.resolve(__dirname, '../../../docs');
const DEST_DIR = path.resolve(__dirname, '../docs');

const EXCLUDE_PATTERNS = [
  '**/archive/**',
  '**/_archive/**',
  '**/drafts/**',
  '**/_drafts/**',
  '**/.github/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/html/**',
  '**/_generated/**',
  '**/.*',
];

const STRICT_MODE = process.argv.includes('--strict');

const stats = {
  copied: 0,
  skipped: 0,
  errors: [],
  warnings: [],
  brokenLinks: [],
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
function normalizeFrontmatter(content, relativePath, sidebarPosition) {
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
  
  return matter.stringify(parsed.content, parsed.data);
}

/**
 * Validate internal links in markdown content
 */
function validateLinks(content, filePath, allFiles) {
  const broken = [];
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const [, , href] = match;
    
    // Skip external links
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
      continue;
    }
    
    // Skip absolute paths starting with /
    if (href.startsWith('/')) {
      continue;
    }
    
    // Resolve relative path
    const dir = path.dirname(filePath);
    let targetPath = path.resolve(dir, href.split('#')[0]);
    
    // Add .md extension if missing
    if (!targetPath.endsWith('.md') && !targetPath.endsWith('.mdx')) {
      if (!targetPath.endsWith('/')) {
        targetPath += '.md';
      } else {
        targetPath += 'index.md';
      }
    }
    
    // Normalize path relative to source
    const relativeTo = path.relative(SOURCE_DIR, targetPath);
    
    // Check if file exists
    if (!allFiles.has(relativeTo) && !allFiles.has(relativeTo.replace('.md', '/index.md'))) {
      broken.push(`${href} (from ${path.relative(SOURCE_DIR, filePath)})`);
    }
  }
  
  return broken;
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
 * Get all markdown files from source
 */
async function getSourceFiles() {
  const files = await fg(['**/*.md', '**/*.mdx'], {
    cwd: SOURCE_DIR,
    ignore: EXCLUDE_PATTERNS,
    dot: false,
  });
  return files.sort();
}

/**
 * Copy and process a single file
 */
async function processFile(relativePath, sidebarPosition, allFiles) {
  const sourcePath = path.join(SOURCE_DIR, relativePath);
  const destPath = path.join(DEST_DIR, relativePath);
  
  try {
    // Read source file
    const content = await fs.readFile(sourcePath, 'utf-8');
    
    // Normalize frontmatter
    const processed = normalizeFrontmatter(content, relativePath, sidebarPosition);
    
    // Validate links
    const brokenLinks = validateLinks(content, sourcePath, allFiles);
    if (brokenLinks.length > 0) {
      stats.brokenLinks.push(...brokenLinks);
    }
    
    // Create destination directory
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    
    // Write processed file
    await fs.writeFile(destPath, processed);
    
    // Log with normalization info
    const addedFields = [];
    if (!matter(content).data.title) addedFields.push('+title');
    if (matter(content).data.sidebar_position === undefined) addedFields.push('+pos');
    
    const suffix = addedFields.length > 0 ? ` (${addedFields.join(', ')})` : '';
    console.log(`   ✓ ${relativePath}${suffix}`);
    
    stats.copied++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stats.errors.push(`${relativePath}: ${message}`);
    console.error(`   ✗ ${relativePath}: ${message}`);
  }
}

/**
 * Main sync function
 */
async function sync() {
  console.log('\n📚 Syncing docs from 4626/docs/ to apps/docs-site/docs/\n');
  
  // Clean destination
  console.log('🗑️  Cleaning destination...');
  await cleanDestination();
  
  // Get all source files
  console.log('📂 Scanning source files...\n');
  const files = await getSourceFiles();
  const allFilesSet = new Set(files);
  
  // Group files by directory for sidebar ordering
  const filesByDir = new Map();
  for (const file of files) {
    const dir = path.dirname(file);
    if (!filesByDir.has(dir)) {
      filesByDir.set(dir, []);
    }
    filesByDir.get(dir).push(file);
  }
  
  // Process files
  for (const file of files) {
    const dir = path.dirname(file);
    const filesInDir = filesByDir.get(dir);
    const position = filesInDir.indexOf(file) + 1;
    await processFile(file, position, allFilesSet);
  }
  
  // Validate links
  console.log('\n🔗 Validating internal links...');
  
  // Print summary
  console.log('\n============================================================');
  console.log('📊 SYNC SUMMARY');
  console.log('============================================================');
  console.log(`   Files copied:  ${stats.copied}`);
  console.log(`   Files skipped: ${stats.skipped}`);
  console.log(`   Errors:        ${stats.errors.length}`);
  console.log(`   Warnings:      ${stats.warnings.length}`);
  console.log('============================================================\n');
  
  // Report broken links
  if (stats.brokenLinks.length > 0) {
    console.log(`⚠️  Found ${stats.brokenLinks.length} broken internal links:`);
    for (const link of stats.brokenLinks) {
      console.log(`   - ${link}`);
    }
    console.log('');
  }
  
  // Handle strict mode
  if (STRICT_MODE) {
    if (stats.errors.length > 0 || stats.brokenLinks.length > 0) {
      console.error('❌ Strict mode: Failing due to errors or broken links\n');
      process.exit(1);
    }
  }
  
  if (stats.errors.length === 0) {
    console.log('✅ Sync completed successfully.\n');
  } else {
    console.log('⚠️  Sync completed with errors.\n');
    if (STRICT_MODE) {
      process.exit(1);
    }
  }
}

// Run
sync().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
