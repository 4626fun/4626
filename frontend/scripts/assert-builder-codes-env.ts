#!/usr/bin/env node

import process from 'node:process'

function parseCodes(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

function isProductionBuildContext(): boolean {
  const vercelEnv = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase()
  if (vercelEnv === 'production') return true

  const explicit = String(process.env.BUILDER_CODES_ENFORCE_PROD ?? '')
    .trim()
    .toLowerCase()
  return explicit === '1' || explicit === 'true'
}

function main(): void {
  if (!isProductionBuildContext()) {
    process.stdout.write(
      '[builder-codes] Skipping production env gate (not a production build context).\n',
    )
    return
  }

  const codes = parseCodes(process.env.VITE_BASE_BUILDER_CODES)
  if (codes.length === 0) {
    process.stderr.write(
      '[builder-codes] Missing VITE_BASE_BUILDER_CODES for production build. ' +
        'Set one or more builder code values (comma-separated).\n',
    )
    process.exitCode = 1
    return
  }

  process.stdout.write(
    `[builder-codes] Production env gate passed with ${codes.length} builder code(s).\n`,
  )
}

main()
