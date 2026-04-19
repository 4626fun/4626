#!/usr/bin/env node

import process from 'node:process'
import type { Hex } from 'viem'

import {
  ERC_8021_MARKER_HEX,
  hasErc8021RepeatingMarker,
  payloadEndsWithDataSuffix,
  resolveBuilderCodes,
  resolveDataSuffix,
} from '../src/lib/base/baseBuilderCodes'

type CliArgs = {
  payload: string | null
  help: boolean
}

function parseArgs(argv: string[]): CliArgs {
  let payload: string | null = null
  let help = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      help = true
      continue
    }
    if (arg === '--payload' || arg === '--tx-data' || arg === '--userop-calldata') {
      payload = argv[i + 1] ?? null
      i += 1
      continue
    }
  }

  return { payload, help }
}

function printUsage(): void {
  process.stdout.write(
    [
      'Usage:',
      '  pnpm -C frontend builder-codes:verify [--payload 0x...]',
      '',
      'Options:',
      '  --payload <hex>          Sample tx input or UserOp callData to validate',
      '  --tx-data <hex>          Alias of --payload',
      '  --userop-calldata <hex>  Alias of --payload',
    ].join('\n'),
  )
  process.stdout.write('\n')
}

function normalizeHex(rawValue: string): Hex {
  const trimmed = String(rawValue ?? '').trim()
  const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (!/^0x[0-9a-fA-F]+$/.test(prefixed)) {
    throw new Error('Payload must be valid hex.')
  }
  return prefixed as Hex
}

function logResult(label: string, ok: boolean, extra?: string): void {
  const icon = ok ? 'OK' : 'NO'
  process.stdout.write(`${icon} ${label}${extra ? ` (${extra})` : ''}\n`)
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  const envForResolution: Record<string, unknown> = {
    ...process.env,
    // Prevent dev-throw behavior in script mode; this utility should always print diagnostics.
    DEV: false,
    PROD: process.env.NODE_ENV === 'production',
  }

  const builderCodes = resolveBuilderCodes(envForResolution)
  const dataSuffix = resolveDataSuffix(envForResolution)

  process.stdout.write('Base Builder Codes verification\n')
  process.stdout.write('--------------------------------\n')
  process.stdout.write(`Builder code(s): ${builderCodes.length > 0 ? builderCodes.join(', ') : '(none)'}\n`)
  process.stdout.write(`DATA_SUFFIX: ${dataSuffix ?? '(not configured)'}\n`)

  if (!dataSuffix) {
    process.stderr.write(
      'Missing suffix config. Set VITE_BASE_BUILDER_CODES (preferred) or VITE_BASE_DATA_SUFFIX in your environment.\n',
    )
    process.exitCode = 1
    return
  }

  logResult('Suffix has ERC-8021 repeating marker tail', hasErc8021RepeatingMarker(dataSuffix), ERC_8021_MARKER_HEX)

  if (args.payload) {
    const payload = normalizeHex(args.payload)
    process.stdout.write(`Payload: ${payload}\n`)
    logResult('Payload ends with DATA_SUFFIX', payloadEndsWithDataSuffix(payload, dataSuffix))
    logResult('Payload has ERC-8021 repeating marker tail', hasErc8021RepeatingMarker(payload))
  }
}

main()
