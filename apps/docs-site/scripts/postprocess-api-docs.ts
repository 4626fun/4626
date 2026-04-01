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
const API_ROOTS = [
  {
    key: 'contracts',
    dir: path.join(DOCS_DIR, 'api/contracts'),
    title: 'Contract API',
    generatedBasePath: '/api/contracts/contracts/',
  },
  {
    key: 'frontend',
    dir: path.join(DOCS_DIR, 'api/frontend'),
    title: 'Frontend API',
    generatedBasePath: '/api/frontend/',
  },
] as const;
const STRICT_MODE = process.argv.includes('--strict');

interface Stats {
  filesScanned: number;
  linksRewritten: number;
  indexesCreated: number;
  duplicateIndexesRemoved: number;
  unresolvedLinks: string[];
}

const stats: Stats = {
  filesScanned: 0,
  linksRewritten: 0,
  indexesCreated: 0,
  duplicateIndexesRemoved: 0,
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
async function createDirectoryIndex(dir: string, apiRootDir: string): Promise<void> {
  const indexPath = path.join(dir, 'index.md');
  const readmePath = path.join(dir, 'README.md');
  
  // Skip if index or README already exists (README also acts as index in Docusaurus)
  if (await pathExists(indexPath) || await pathExists(readmePath)) {
    return;
  }
  
  const dirName = path.basename(dir);
  const title = toTitleCase(dirName);
  const relPath = path.relative(apiRootDir, dir);
  
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
function normalizeLocalMarkdownLinks(content: string): { content: string; rewrites: number } {
  let rewrites = 0;
  const normalized = content.replace(/\]\(([^)]+)\)/g, (match, rawTarget) => {
    if (
      rawTarget.startsWith('http') ||
      rawTarget.startsWith('mailto:') ||
      rawTarget.startsWith('#')
    ) {
      return match;
    }

    const [pathPart, hashPart] = rawTarget.split('#', 2);
    if (!pathPart.endsWith('.md')) {
      return match;
    }

    rewrites++;
    const withoutExtension = pathPart.slice(0, -3);
    return `](${withoutExtension}${hashPart ? `#${hashPart}` : ''})`;
  });

  return { content: normalized, rewrites };
}

async function removeDuplicateIndexIfReadmeExists(dir: string): Promise<void> {
  const indexPath = path.join(dir, 'index.md');
  const readmePath = path.join(dir, 'README.md');
  if (await pathExists(indexPath) && await pathExists(readmePath)) {
    await fs.rm(indexPath, { force: true });
    stats.duplicateIndexesRemoved++;
  }
}

async function fixLinksInFile(filePath: string, apiRoot: (typeof API_ROOTS)[number]): Promise<void> {
  let content = await fs.readFile(filePath, 'utf-8');
  const originalContent = content;
  
  // Track link rewrites for this file
  let fileRewrites = 0;
  
  // Pattern 1: Absolute links to /contracts/... that weren't caught by sync-docs
  if (apiRoot.key === 'contracts') {
    content = content.replace(
      /\]\(\/contracts\/([^)]+)\)/g,
      (match, linkPath) => {
        if (linkPath.startsWith('http') || linkPath.startsWith('#')) {
          return match;
        }

        const cleanPath = linkPath.replace(/\.md$/, '');
        fileRewrites++;
        return `](${apiRoot.generatedBasePath}${cleanPath})`;
      }
    );

    // Pattern 1b: Repo-root docs links from generated contract READMEs.
    // Example: (docs/audits/README.md) -> (/audits/README)
    content = content.replace(
      /\]\((docs\/[^)#]+)(#[^)]+)?\)/g,
      (_match, docsPath, hashPart) => {
        const cleanPath = String(docsPath)
          .replace(/^docs\//, '')
          .replace(/\.md$/, '');
        fileRewrites++;
        return `](/${cleanPath}${hashPart ?? ''})`;
      }
    );

    // Pattern 1c: Frontend docs links from generated contract READMEs.
    // Example: (frontend/docs/foo.md) -> (/frontend/foo)
    content = content.replace(
      /\]\((frontend\/docs\/[^)#]+)(#[^)]+)?\)/g,
      (_match, frontendDocPath, hashPart) => {
        const cleanPath = String(frontendDocPath)
          .replace(/^frontend\/docs\//, '')
          .replace(/\.md$/, '');
        fileRewrites++;
        return `](/frontend/${cleanPath}${hashPart ?? ''})`;
      }
    );

    // Pattern 1d: Frontend and CRE README references from repo root docs.
    content = content.replace(/\]\(frontend\/README\.md\)/g, () => {
      fileRewrites++;
      return '](/frontend/overview)';
    });
    content = content.replace(/\]\(cre\/README\.md\)/g, () => {
      fileRewrites++;
      return '](/operations/cre/)';
    });

    // Pattern 1e: AGENTS.md is not part of docs-site content; link to GitHub.
    content = content.replace(/\]\((?:\.\/)?AGENTS(?:\.md)?\)/g, () => {
      fileRewrites++;
      return '](https://github.com/wenakita/4626/blob/main/AGENTS.md)';
    });
  }

  // Pattern 2: Local markdown links should omit the extension for Docusaurus
  const normalized = normalizeLocalMarkdownLinks(content);
  content = normalized.content;
  fileRewrites += normalized.rewrites;
  
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
    
    const targetPathWithoutAnchor = linkTarget.split('#', 1)[0];

    // Check if relative link target exists
    const targetPath = path.resolve(fileDir, targetPathWithoutAnchor);
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
  
  if (!(await Promise.all(API_ROOTS.map((root) => pathExists(root.dir)))).some(Boolean)) {
    console.log('⚠️  API docs directories not found. Run sync-docs first.');
    return;
  }
  
  // Step 1: Create index.md for directories
  console.log('📁 Creating directory indexes...');
  for (const apiRoot of API_ROOTS) {
    if (!await pathExists(apiRoot.dir)) continue;
    const directories = await getAllDirectories(apiRoot.dir);
    directories.unshift(apiRoot.dir);

    for (const dir of directories) {
      await removeDuplicateIndexIfReadmeExists(dir);
      await createDirectoryIndex(dir, apiRoot.dir);
    }
  }
  console.log(`   ✓ Created ${stats.indexesCreated} index files`);
  console.log(`   ✓ Removed ${stats.duplicateIndexesRemoved} duplicate index files`);
  
  // Step 2: Fix links in all markdown files
  console.log('\n🔗 Fixing links...');
  const files: string[] = [];
  for (const apiRoot of API_ROOTS) {
    if (!await pathExists(apiRoot.dir)) continue;
    const rootFiles = await getAllMarkdownFiles(apiRoot.dir);
    files.push(...rootFiles);

    for (const file of rootFiles) {
      await fixLinksInFile(file, apiRoot);
    }
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
