/**
 * Classify live creator-share-hook bytecode (legacy drain/flush vs canonical relay/settle).
 */

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const CREATOR_SHARE_HOOK_PROGRAM_ID = 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'

export type HookBytecodeKind = 'canonical' | 'legacy' | 'unknown'

export type HookBytecodeReport = {
  programId: string
  rpcUrl: string
  kind: HookBytecodeKind
  dataLengthBytes: number | null
  lastDeployedSlot: string | null
  dumpBytes: number | null
  sha256: string | null
  hardening: {
    relayEntries: boolean
    settleFees: boolean
    transferInProgressGate: boolean
    mintBindingGate: boolean
  }
  expectedArtifact: {
    sha256: string
    executableBytes: number
    deployedPaddingBytes: number
    matches: boolean
  } | null
  programShow: string
}

function runSolana(args: string[]): string {
  return execFileSync('solana', args, { encoding: 'utf8' }).trim()
}

export function classifyHookBytecodeStrings(text: string): HookBytecodeKind {
  const hasCanonical = /relay_entries|RelayEntries|settle_fees|SettleFees/.test(text)
  const hasLegacy = /drain_entries|DrainEntries|flush_fees|FlushFees/.test(text)
  if (hasCanonical && !hasLegacy) return 'canonical'
  if (hasLegacy && !hasCanonical) return 'legacy'
  return 'unknown'
}

function hardeningFromStrings(text: string): HookBytecodeReport['hardening'] {
  return {
    relayEntries: /relay_entries|RelayEntries/.test(text),
    settleFees: /settle_fees|SettleFees/.test(text),
    transferInProgressGate: text.includes('No Token-2022 transfer in progress'),
    mintBindingGate: text.includes('Token account mint does not match the hooked mint'),
  }
}

export function inspectHookBytecode(params?: {
  rpcUrl?: string
  programId?: string
  expectedArtifactPath?: string
}): HookBytecodeReport {
  const programId = params?.programId ?? CREATOR_SHARE_HOOK_PROGRAM_ID
  const rpcUrl = params?.rpcUrl?.trim() || process.env.SOLANA_RPC_URL?.trim() || 'https://api.mainnet-beta.solana.com'

  const programShow = runSolana(['program', 'show', programId, '--url', rpcUrl])
  const dataLengthMatch = programShow.match(/Data Length:\s+(\d+)/)
  const slotMatch = programShow.match(/Last Deployed In Slot:\s+(\d+)/)

  const dir = mkdtempSync(join(tmpdir(), 'hook-bytecode-'))
  const dumpPath = join(dir, 'creator_share_hook.so')
  let kind: HookBytecodeKind = 'unknown'
  let dumpBytes: number | null = null
  let sha256: string | null = null
  let hardening: HookBytecodeReport['hardening'] = {
    relayEntries: false,
    settleFees: false,
    transferInProgressGate: false,
    mintBindingGate: false,
  }
  let expectedArtifact: HookBytecodeReport['expectedArtifact'] = null

  try {
    runSolana(['program', 'dump', programId, dumpPath, '--url', rpcUrl])
    const blob = readFileSync(dumpPath)
    dumpBytes = blob.length
    sha256 = createHash('sha256').update(blob).digest('hex')
    const stringsOut = execFileSync('strings', [dumpPath], { encoding: 'utf8' })
    kind = classifyHookBytecodeStrings(stringsOut)
    hardening = hardeningFromStrings(stringsOut)
    if (params?.expectedArtifactPath) {
      const artifact = readFileSync(params.expectedArtifactPath)
      const padding = blob.subarray(artifact.length)
      expectedArtifact = {
        sha256: createHash('sha256').update(artifact).digest('hex'),
        executableBytes: artifact.length,
        deployedPaddingBytes: Math.max(0, blob.length - artifact.length),
        matches:
          blob.length >= artifact.length &&
          blob.subarray(0, artifact.length).equals(artifact) &&
          padding.every((byte) => byte === 0),
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  return {
    programId,
    rpcUrl,
    kind,
    dataLengthBytes: dataLengthMatch ? Number(dataLengthMatch[1]) : null,
    lastDeployedSlot: slotMatch?.[1] ?? null,
    dumpBytes,
    sha256,
    hardening,
    expectedArtifact,
    programShow,
  }
}

/** @deprecated Use inspectHookBytecode for explicit cluster selection. */
export function inspectHookMainnetBytecode(params?: {
  rpcUrl?: string
  programId?: string
}): HookBytecodeReport {
  return inspectHookBytecode(params)
}

export function recommendedHookIxSchema(kind: HookBytecodeKind): 'canonical' | 'legacy' {
  return kind === 'canonical' ? 'canonical' : 'legacy'
}
