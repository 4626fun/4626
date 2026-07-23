#!/usr/bin/env node
/**
 * Read-only exact-byte verifier for an approved devnet-only hook surrogate.
 * It refuses the canonical mainnet program ID and requires the deployed bytes
 * to equal the locally rebuilt, ID-bound artifact exactly.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

import { inspectHookBytecode } from './hookBytecodeClassify.js'

const CANONICAL_PROGRAM_ID = 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function isDevnetOrLocal(rpc: string): boolean {
  return /devnet|testnet|localhost|127\.0\.0\.1/i.test(rpc)
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function main(): void {
  const programId = env('SOLANA_DEVNET_HOOK_PROGRAM_ID')
  const rpc = env('SOLANA_DEVNET_RPC_URL') || env('RPC_URL_SOLANA_TESTNET')
  const artifact = env('SOLANA_DEVNET_HOOK_SO_PATH')
  if (!programId || programId === CANONICAL_PROGRAM_ID) throw new Error('devnet_surrogate_program_id_required')
  if (!rpc || !isDevnetOrLocal(rpc)) throw new Error('devnet_or_local_rpc_required')
  if (!artifact || !existsSync(artifact)) throw new Error('devnet_surrogate_artifact_required')

  const report = inspectHookBytecode({
    programId,
    rpcUrl: rpc,
    expectedArtifactPath: artifact,
  })
  const localHash = sha256(artifact)
  const hardeningOk = Object.values(report.hardening).every(Boolean)
  const artifactMatches = report.expectedArtifact?.matches === true
  process.stdout.write(`${JSON.stringify({
    programId: report.programId,
    rpc: new URL(rpc).origin,
    classification: report.kind,
    deployedSha256: report.sha256,
    localSha256: localHash,
    executableBytes: report.expectedArtifact?.executableBytes ?? null,
    deployedPaddingBytes: report.expectedArtifact?.deployedPaddingBytes ?? null,
    hardening: report.hardening,
    artifactMatches,
  }, null, 2)}\n`)
  if (report.kind !== 'canonical' || !hardeningOk || !artifactMatches) {
    throw new Error('devnet_surrogate_bytecode_mismatch')
  }
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
