/**
 * Postprocess API Docs
 * 
 * This script runs after sync-docs to ensure generated API docs are
 * fully link-correct and production-grade.
 * 
 * It:
 * 1. Creates index.md for directories that lack them
 * 2. Validates and fixes internal links
 * 3. Reports any unresolved issues
 * 
 * Usage:
 *   pnpm api:postprocess
 *   pnpm api:postprocess --strict  (fail on unresolved links)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.resolve(__dirname, '../docs');
const API_CONTRACTS_DIR = path.join(DOCS_DIR, 'api/contracts');
const STRICT_MODE = process.argv.includes('--strict');

interface Stats {
  filesScanned: number;
  linksRewritten: number;
  indexesCreated: number;
  unresolvedLinks: string[];
}

const stats: Stats = {
  filesScanned: 0,
  linksRewritten: 0,
  indexesCreated: 0,
  unresolvedLinks: [],
};

/**
 * Convert a path segment to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .replace(/\.sol$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Check if a path exists
 */
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all directories under a path (recursive)
 */
async function getAllDirectories(dir: string): Promise<string[]> {
  const dirs: string[] = [];
  
  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(currentDir, entry.name);
        dirs.push(fullPath);
        await walk(fullPath);
      }
    }
  }
  
  await walk(dir);
  return dirs;
}

/**
 * Get all markdown files under a path (recursive)
 */
async function getAllMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return files;
}

/**
 * Create index.md for a directory
 */
async function createDirectoryIndex(dir: string): Promise<void> {
  const indexPath = path.join(dir, 'index.md');
  const readmePath = path.join(dir, 'README.md');
  
  // Skip if index or README already exists (README also acts as index in Docusaurus)
  if (await pathExists(indexPath) || await pathExists(readmePath)) {
    return;
  }
  
  const dirName = path.basename(dir);
  const title = toTitleCase(dirName);
  const relPath = path.relative(API_CONTRACTS_DIR, dir);
  
  // Get children
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
  const files = entries.filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md').map(e => e.name).sort();
  
  // Build content
  let content = `---
title: ${title}
generated: true
---

# ${title}

Auto-generated API documentation for \`${relPath || 'contracts'}\`.

`;

  if (subdirs.length > 0) {
    content += `## Subdirectories\n\n`;
    for (const subdir of subdirs) {
      content += `- [${toTitleCase(subdir)}](./${subdir}/)\n`;
    }
    content += '\n';
  }

  if (files.length > 0) {
    content += `## Contents\n\n`;
    for (const file of files) {
      const name = file.replace(/\.md$/, '');
      content += `- [${toTitleCase(name)}](./${name})\n`;
    }
    content += '\n';
  }

  content += `---\n\n*This page is auto-generated. Do not edit directly.*\n`;

  await fs.writeFile(indexPath, content);
  stats.indexesCreated++;
}

/**
 * Fix links in a markdown file
 */
async function fixLinksInFile(filePath: string): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');
  const originalContent = content;
  
  // Track link rewrites for this file
  let fileRewrites = 0;
  
  // Pattern 1: Absolute links to /contracts/... that weren't caught by sync-docs
  // These should point to /api/contracts/contracts/...
  content = content.replace(
    /\]\(\/contracts\/([^)]+)\)/g,
    (match, linkPath) => {
      // Skip if it's an external link or anchor
      if (linkPath.startsWith('http') || linkPath.startsWith('#')) {
        return match;
      }
      
      // Remove .md extension if present
      const cleanPath = linkPath.replace(/\.md$/, '');
      fileRewrites++;
      return `](/api/contracts/contracts/${cleanPath})`;
    }
  );
  
  // Pattern 2: Relative links with .md extension (Docusaurus prefers without)
  content = content.replace(
    /\]\(\.\.?\/[^)]+\.md\)/g,
    (match) => {
      fileRewrites++;
      return match.replace(/\.md\)$/, ')');
    }
  );
  
  // Pattern 3: Fix malformed interface links (common forge doc issue)
  // e.g., interface.IStrategy.md -> interface.IStrategy
  content = content.replace(
    /\]\(([^)]*interface\.[A-Z][^)]*?)\.md\)/g,
    (match, linkPath) => {
      fileRewrites++;
      return `](${linkPath})`;
    }
  );
  
  if (content !== originalContent) {
    await fs.writeFile(filePath, content);
    stats.linksRewritten += fileRewrites;
  }
  
  stats.filesScanned++;
}

/**
 * Validate links in a markdown file
 */
async function validateLinksInFile(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const fileDir = path.dirname(filePath);
  
  // Find all markdown links
  const linkPattern = /\]\(([^)]+)\)/g;
  let match;
  
  while ((match = linkPattern.exec(content)) !== null) {
    const linkTarget = match[1];
    
    // Skip external links, anchors, and absolute paths (handled by Docusaurus)
    if (linkTarget.startsWith('http') || 
        linkTarget.startsWith('#') || 
        linkTarget.startsWith('/')) {
      continue;
    }
    
    // Check if relative link target exists
    const targetPath = path.resolve(fileDir, linkTarget);
    const targetWithMd = targetPath.endsWith('.md') ? targetPath : `${targetPath}.md`;
    const targetIndex = path.join(targetPath, 'index.md');
    
    const exists = await pathExists(targetPath) || 
                   await pathExists(targetWithMd) || 
                   await pathExists(targetIndex);
    
    if (!exists) {
      const relFile = path.relative(DOCS_DIR, filePath);
      stats.unresolvedLinks.push(`${relFile}: ${linkTarget}`);
    }
  }
}

/**
 * Main postprocess function
 */
async function postprocess(): Promise<void> {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('🔧 Postprocessing API Docs');
  console.log('════════════════════════════════════════════════════════════\n');
  
  // Check if API docs exist
  if (!await pathExists(API_CONTRACTS_DIR)) {
    console.log('⚠️  API contracts directory not found. Run sync-docs first.');
    return;
  }
  
  // Step 1: Create index.md for directories
  console.log('📁 Creating directory indexes...');
  const directories = await getAllDirectories(API_CONTRACTS_DIR);
  directories.unshift(API_CONTRACTS_DIR); // Include root
  
  for (const dir of directories) {
    await createDirectoryIndex(dir);
  }
  console.log(`   ✓ Created ${stats.indexesCreated} index files`);
  
  // Step 2: Fix links in all markdown files
  console.log('\n🔗 Fixing links...');
  const files = await getAllMarkdownFiles(API_CONTRACTS_DIR);
  
  for (const file of files) {
    await fixLinksInFile(file);
  }
  console.log(`   ✓ Scanned ${stats.filesScanned} files`);
  console.log(`   ✓ Rewrote ${stats.linksRewritten} links`);
  
  // Step 3: Validate links
  console.log('\n✅ Validating links...');
  for (const file of files) {
    await validateLinksInFile(file);
  }
  
  // Summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('📊 POSTPROCESS SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`   Files scanned:     ${stats.filesScanned}`);
  console.log(`   Links rewritten:   ${stats.linksRewritten}`);
  console.log(`   Indexes created:   ${stats.indexesCreated}`);
  console.log(`   Unresolved links:  ${stats.unresolvedLinks.length}`);
  console.log('════════════════════════════════════════════════════════════\n');
  
  if (stats.unresolvedLinks.length > 0) {
    console.log('⚠️  Unresolved links:');
    for (const link of stats.unresolvedLinks.slice(0, 20)) {
      console.log(`   - ${link}`);
    }
    if (stats.unresolvedLinks.length > 20) {
      console.log(`   ... and ${stats.unresolvedLinks.length - 20} more`);
    }
    console.log('');
    
    if (STRICT_MODE) {
      console.error('❌ Strict mode: Failing due to unresolved links\n');
      process.exit(1);
    }
  }
  
  console.log('✅ Postprocessing complete.\n');
}

// Run
postprocess().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
