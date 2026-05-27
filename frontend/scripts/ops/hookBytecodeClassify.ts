/**
 * Classify live creator-share-hook bytecode (legacy drain/flush vs canonical relay/settle).
 */

import { execFileSync } from 'node:child_process'
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
  programShow: string
}

function runSolana(args: string[]): string {
  return execFileSync('solana', args, { encoding: 'utf8' }).trim()
}

function classifyStrings(text: string): HookBytecodeKind {
  const hasCanonical = /relay_entries|RelayEntries|settle_fees|SettleFees/.test(text)
  const hasLegacy = /drain_entries|DrainEntries|flush_fees|FlushFees/.test(text)
  if (hasCanonical && !hasLegacy) return 'canonical'
  if (hasLegacy && !hasCanonical) return 'legacy'
  return 'unknown'
}

export function inspectHookMainnetBytecode(params?: {
  rpcUrl?: string
  programId?: string
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

  try {
    runSolana(['program', 'dump', programId, dumpPath, '--url', rpcUrl])
    const blob = readFileSync(dumpPath)
    dumpBytes = blob.length
    const stringsOut = execFileSync('strings', [dumpPath], { encoding: 'utf8' })
    kind = classifyStrings(stringsOut)
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
    programShow,
  }
}

export function recommendedHookIxSchema(kind: HookBytecodeKind): 'canonical' | 'legacy' {
  return kind === 'canonical' ? 'canonical' : 'legacy'
}
