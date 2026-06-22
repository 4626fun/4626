#!/usr/bin/env node
/**
 * Static CI guard: CreatorOVault delegate-epilogue invariant.
 *
 * Invariant:
 *   In CreatorOVault.sol, any external/public function with a nonReentrant
 *   modifier must call _delegateAndReturn(...), never _delegate(...).
 *
 * Why:
 *   _delegate() ends with an assembly `return` that bypasses modifier
 *   epilogues. OZ nonReentrant resets _status in its epilogue; if the
 *   epilogue never runs, the reentrancy lock stays engaged and the
 *   function is permanently DoSed after a single call.
 *   _delegateAndReturn() returns normally via Solidity return, so
 *   modifier epilogues execute correctly.
 *
 * This guard statically parses CreatorOVault.sol, identifies every
 * external/public function with nonReentrant, and fails loudly with
 * the function name and line number if any such function calls
 * _delegate() instead of _delegateAndReturn().
 *
 * Run: node scripts/check-ovault-delegate-epilogues.mjs
 *      pnpm guard:ovault-delegate-epilogues
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const targetFile = path.join(repoRoot, 'contracts/vault/CreatorOVault.sol');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}[FAIL]${RESET} ${msg}`);
}

function ok(msg) {
  console.log(`${GREEN}[ok]${RESET}   ${msg}`);
}

function info(msg) {
  console.log(`${CYAN}[..]${RESET}   ${msg}`);
}

/**
 * Parse Solidity source and extract function blocks.
 * Returns array of { name, startLine, headerText, bodyText, headerLineNum }
 *
 * A function block is:
 *   function <name>(...) <modifiers> { <body> }
 *
 * We track brace depth to find the matching closing brace.
 * We skip comment lines so they don't interfere with brace counting.
 */
function parseFunctions(src) {
  const lines = src.split('\n');
  const functions = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Match function declaration at line start.
    // Excludes "function " inside comments or strings.
    const funcMatch = trimmed.match(/^function\s+(\w+)\s*\(/);
    if (!funcMatch) {
      i++;
      continue;
    }

    const funcName = funcMatch[1];
    const headerLineNum = i + 1; // 1-indexed

    // Collect header (signature + modifiers) until the opening brace
    // at brace depth 0. The header may span multiple lines.
    let headerLines = [];
    let bodyLines = [];
    let braceDepth = 0;
    let headerDone = false;
    let inBlockComment = false;

    for (let j = i; j < lines.length; j++) {
      let lineContent = lines[j];

      // Strip block comments for brace-tracking purposes
      // (inline /* ... */ or multi-line block comments)
      let cleaned = '';
      let k = 0;
      while (k < lineContent.length) {
        if (inBlockComment) {
          const endIdx = lineContent.indexOf('*/', k);
          if (endIdx === -1) {
            k = lineContent.length;
          } else {
            inBlockComment = false;
            k = endIdx + 2;
          }
        } else {
          const blockStart = lineContent.indexOf('/*', k);
          const lineComment = lineContent.indexOf('//', k);
          if (blockStart !== -1 && (lineComment === -1 || blockStart < lineComment)) {
            cleaned += lineContent.slice(k, blockStart);
            inBlockComment = true;
            k = blockStart + 2;
          } else if (lineComment !== -1) {
            cleaned += lineContent.slice(k, lineComment);
            k = lineContent.length;
          } else {
            cleaned += lineContent.slice(k);
            k = lineContent.length;
          }
        }
      }

      // Count braces in the cleaned content
      const wasHeaderDone = headerDone;
      for (const ch of cleaned) {
        if (ch === '{') {
          if (braceDepth === 0 && !headerDone) {
            headerDone = true;
          }
          braceDepth++;
        } else if (ch === '}') {
          braceDepth--;
        }
      }

      // On the transition line (where { first appears), the line contains
      // both the tail of the header and the start of the body. Push to both
      // so hasNonReentrant sees the modifier list and findBareDelegateCalls
      // sees the body.
      if (!wasHeaderDone) {
        headerLines.push(lineContent);
      }
      if (headerDone) {
        bodyLines.push(lineContent);
      }

      if (headerDone && braceDepth === 0) {
        // End of function body
        functions.push({
          name: funcName,
          startLine: headerLineNum,
          headerText: headerLines.join('\n'),
          bodyText: bodyLines.join('\n'),
          headerLineNum,
        });
        i = j + 1;
        break;
      }

      if (j === lines.length - 1) {
        // Reached EOF without closing brace — malformed
        i = j + 1;
      }
    }

    if (!headerDone) {
      i++;
    }
  }

  return functions;
}

/**
 * Check if a function header contains the nonReentrant modifier.
 * We look for the word "nonReentrant" as a standalone identifier
 * (not inside a comment or string).
 */
function hasNonReentrant(headerText) {
  // Strip comments from header
  const cleaned = headerText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return /\bnonReentrant\b/.test(cleaned);
}

/**
 * Check if a function header indicates external or public visibility.
 * Functions without explicit visibility default to public in Solidity.
 * Internal and private functions are excluded.
 */
function isExternalOrPublic(headerText) {
  const cleaned = headerText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  if (/\binternal\b/.test(cleaned) || /\bprivate\b/.test(cleaned)) {
    return false;
  }
  // external, public, or no explicit visibility (defaults to public)
  return true;
}

/**
 * Check if the function body contains a bare _delegate() call
 * (not _delegateAndReturn()).
 *
 * _delegate( as a substring does NOT appear in _delegateAndReturn(
 * because the ( follows immediately after _delegate, while in
 * _delegateAndReturn( the ( comes after "Return".
 */
function hasBareDelegate(bodyText) {
  // Strip comments from body to avoid false positives from doc comments
  const cleaned = bodyText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  // Match _delegate( but NOT _delegateAndReturn(
  // Since _delegate( is not a substring of _delegateAndReturn(,
  // a simple includes check works. But we also use regex for robustness
  // against whitespace: _delegate  (  should still match.
  // Negative lookahead ensures we don't match _delegateAndReturn
  return /_delegate\s*\(/.test(cleaned) && !/_delegateAndReturn\s*\(/.test(cleaned.replace(/_delegateAndReturn\s*\(/g, ''));
}

/**
 * More precise check: find all occurrences of _delegate( in the body
 * that are NOT part of _delegateAndReturn(.
 */
function findBareDelegateCalls(bodyText, bodyStartLine) {
  const cleaned = bodyText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const lines = cleaned.split('\n');
  const violations = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    // Find _delegate( in this line
    let pos = 0;
    while (true) {
      const found = line.indexOf('_delegate(', pos);
      if (found === -1) break;

      // Check if this is actually _delegateAndReturn( by looking at
      // the characters after _delegate
      const afterDelegate = line.slice(found + '_delegate'.length);
      // If it starts with "AndReturn", it's _delegateAndReturn — skip
      if (afterDelegate.startsWith('AndReturn')) {
        pos = found + 1;
        continue;
      }

      // Also handle whitespace: _delegate  (  should match
      // Check if after _delegate there's optional whitespace then (
      const match = afterDelegate.match(/^\s*\(/);
      if (match) {
        violations.push({
          line: bodyStartLine + idx,
          text: line.trim(),
        });
      }
      pos = found + 1;
    }
  }

  return violations;
}

function main() {
  if (!fs.existsSync(targetFile)) {
    fail(`CreatorOVault.sol not found at ${targetFile}`);
    process.exit(1);
  }

  info(`Checking ${path.relative(repoRoot, targetFile)}`);

  const src = fs.readFileSync(targetFile, 'utf8');
  const functions = parseFunctions(src);

  info(`Found ${functions.length} function declarations`);

  let violations = 0;
  let checked = 0;

  for (const func of functions) {
    if (!isExternalOrPublic(func.headerText)) {
      continue;
    }

    if (!hasNonReentrant(func.headerText)) {
      continue;
    }

    checked++;

    // This is an external/public function with nonReentrant.
    // It must NOT call _delegate() — only _delegateAndReturn().
    const bodyStartLine = func.startLine + func.headerText.split('\n').length;
    const bareCalls = findBareDelegateCalls(func.bodyText, bodyStartLine);

    if (bareCalls.length > 0) {
      for (const call of bareCalls) {
        fail(`${targetFile}:${call.line}: function "${func.name}" has nonReentrant but calls _delegate() at line ${call.line}`);
        fail(`  _delegate() uses assembly return which bypasses the nonReentrant epilogue.`);
        fail(`  Use _delegateAndReturn() instead so the modifier epilogue executes.`);
        console.error(`  ${YELLOW}Context:${RESET} ${call.text}`);
      }
      violations++;
    }
  }

  if (violations > 0) {
    console.error(`\n${RED}[FAIL]${RESET} ${violations} function(s) with nonReentrant call _delegate() instead of _delegateAndReturn().`);
    console.error(`       This is a P1 DoS vector — the reentrancy lock never releases.`);
    process.exit(1);
  }

  ok(`${checked} external/public nonReentrant function(s) checked — all use _delegateAndReturn().`);
  console.log(`\n${GREEN}ovault-delegate-epilogues guard passed.${RESET}`);
}

main();
