#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { reportGuard } from './guard-utils.mjs'

const repoRoot = path.resolve(process.cwd())
const apiRoot = path.join(repoRoot, 'api')
const exts = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

const bannedPatterns = [
  /server\/auth\/_shared\.js$/,
  /server\/_lib\/agentApiGuard\.js$/,
  /server\/_lib\/agent\/agentApiGuard\.js$/,
  /server\/_lib\/contracts\.js$/,
  /server\/_lib\/logger\.js$/,
  /server\/_lib\/infra\/logger\.js$/,
  /server\/_lib\/postgres\.js$/,
  /server\/_lib\/db\/postgres\.js$/,
  /server\/_lib\/rateLimit\.js$/,
  /server\/_lib\/infra\/rateLimit\.js$/,
  /server\/_lib\/requestPrincipal\.js$/,
  /server\/_lib\/auth\/requestPrincipal\.js$/,
  /server\/_lib\/session\.js$/,
  /server\/_lib\/auth\/session\.js$/,
  /server\/_lib\/chatCommandCenterTelemetry\.js$/,
  /server\/_lib\/chatCommandFallback\.js$/,
  /server\/_lib\/creatorXmtpAgents\.js$/,
  /server\/_lib\/telegramBotApi\.js$/,
  /server\/_lib\/telegramLinkTelemetry\.js$/,
  /server\/_lib\/telegramTrading\.js$/,
  /server\/_lib\/xmtpDbDirectory\.js$/,
  /server\/_lib\/xmtpDbEncryption\.js$/,
  /server\/_lib\/walletIntelligence\.js$/,
  /server\/_lib\/walletIntelligenceCache\.js$/,
  /server\/_lib\/walletLabels\.js$/,
  /server\/_lib\/walletMapping\.js$/,
  /server\/_lib\/walletSync\.js$/,
  /server\/_lib\/messaging\/chatCommandCenterTelemetry\.js$/,
  /server\/_lib\/messaging\/chatCommandFallback\.js$/,
  /server\/_lib\/messaging\/creatorXmtpAgents\.js$/,
  /server\/_lib\/messaging\/telegramBotApi\.js$/,
  /server\/_lib\/messaging\/telegramLinkTelemetry\.js$/,
  /server\/_lib\/messaging\/telegramTrading\.js$/,
  /server\/_lib\/messaging\/xmtpDbDirectory\.js$/,
  /server\/_lib\/messaging\/xmtpDbEncryption\.js$/,
  /server\/_lib\/wallet\/walletIntelligence\.js$/,
  /server\/_lib\/wallet\/walletIntelligenceCache\.js$/,
  /server\/_lib\/wallet\/walletLabels\.js$/,
  /server\/_lib\/wallet\/walletMapping\.js$/,
  /server\/_lib\/wallet\/walletSync\.js$/,
]

const importRegex =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function shouldScanFile(filePath) {
  const rel = path.relative(apiRoot, filePath).replace(/\\/g, '/')
  if (rel.startsWith('__tests__/')) return false
  return true
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
      continue
    }
    if (!exts.has(path.extname(entry.name))) continue
    if (!shouldScanFile(full)) continue
    out.push(full)
  }
  return out
}

function isBannedSpecifier(specifier) {
  return bannedPatterns.some((pattern) => pattern.test(specifier))
}

async function main() {
  const files = await walk(apiRoot)
  const violations = []

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8')
    importRegex.lastIndex = 0
    for (let match = importRegex.exec(source); match; match = importRegex.exec(source)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      if (!isBannedSpecifier(specifier)) continue
      violations.push({
        file: path.relative(repoRoot, filePath),
        specifier,
      })
    }
  }

  const exitCode = reportGuard({
    guard: 'API runtime files respect server-core boundary',
    violations,
    checks: ['API runtime files do not directly import server-core-owned primitives'],
    remediation: [
      'Use packages/server-core/src/index.js for shared auth/session/contracts/logging/db/rate-limit/request-principal primitives.',
    ],
  })
  process.exit(exitCode)
}

main().catch((error) => {
  const exitCode = reportGuard({
    guard: 'API runtime files respect server-core boundary',
    fatalError: String(error?.message ?? error),
  })
  process.exit(exitCode)
})

