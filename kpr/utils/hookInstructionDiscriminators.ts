/**
 * Anchor instruction discriminators for creator-share-hook.
 *
 * Canonical ix names: `relay_entries`, `settle_fees` (no drain/flush wording).
 * Opt into pre-Mar-2026 mainnet bytecode only via SOLANA_HOOK_IX_SCHEMA=legacy.
 */

import * as crypto from 'node:crypto'

export type HookInstructionSchema = 'canonical' | 'legacy'

export function resolveHookInstructionSchema(): HookInstructionSchema {
  const raw = String(process.env.SOLANA_HOOK_IX_SCHEMA ?? 'canonical').trim().toLowerCase()
  return raw === 'legacy' ? 'legacy' : 'canonical'
}

function anchorDiscriminator(globalName: string): Buffer {
  return crypto.createHash('sha256').update(globalName).digest().subarray(0, 8)
}

export function relayEntriesInstructionDiscriminator(schema = resolveHookInstructionSchema()): Buffer {
  return anchorDiscriminator(
    schema === 'legacy' ? 'global:drain_entries' : 'global:relay_entries',
  )
}

export function settleFeesInstructionDiscriminator(schema = resolveHookInstructionSchema()): Buffer {
  return anchorDiscriminator(schema === 'legacy' ? 'global:flush_fees' : 'global:settle_fees')
}

/** @deprecated use relayEntriesInstructionDiscriminator */
export const relayEntriesFlushDiscriminator = relayEntriesInstructionDiscriminator

/** @deprecated use settleFeesInstructionDiscriminator */
export const settleFeesDiscriminator = settleFeesInstructionDiscriminator
