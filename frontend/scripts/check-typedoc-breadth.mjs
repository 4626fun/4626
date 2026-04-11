#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

const typedocPath = path.resolve(process.cwd(), 'typedoc.json');
const raw = readFileSync(typedocPath, 'utf8');
const config = JSON.parse(raw);

const entryPoints = new Set(Array.isArray(config.entryPoints) ? config.entryPoints : []);
const excludes = new Set(Array.isArray(config.exclude) ? config.exclude : []);

const requiredEntryPoints = ['src', 'api', 'server'];
const forbiddenBroadExcludes = [
  'src/hooks/**',
  'src/pages/**',
  'src/components/**',
  'server/_lib/**',
  'server/agent/**',
  'server/keepr/**',
  'server/uniswap/**',
  'server/zora/**',
];

const missingEntryPoints = requiredEntryPoints.filter((entry) => !entryPoints.has(entry));
const presentForbiddenExcludes = forbiddenBroadExcludes.filter((pattern) => excludes.has(pattern));

if (missingEntryPoints.length > 0 || presentForbiddenExcludes.length > 0) {
  console.error('[docs] TypeDoc breadth guard failed.');
  if (missingEntryPoints.length > 0) {
    console.error(`[docs] Missing required entryPoints: ${missingEntryPoints.join(', ')}`);
  }
  if (presentForbiddenExcludes.length > 0) {
    console.error('[docs] Remove broad exclude patterns to preserve API surface coverage:');
    for (const pattern of presentForbiddenExcludes) {
      console.error(`- ${pattern}`);
    }
  }
  process.exit(1);
}

console.log('[docs] TypeDoc breadth guard passed.');
