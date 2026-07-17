/**
 * Finalized event-log ingestion for Solana lottery eligibility (SOL-P1-02).
 *
 * Canonical source = authenticated Anchor `Program data:` events inside the
 * hook program invoke window. Ring buffer is never the sole source.
 */

import { decodeHookLotteryEventsFromLogs } from './solanaLotteryAnchorEvents.js'
import {
  advanceIngestCursor,
  getIngestCursor,
  upsertSolanaLotteryInboxEvent,
  type SolanaLotteryInstructionKind,
} from './solanaLotteryEntryInbox.js'
import { buildSolanaLotterySourceEventId } from './solanaLotterySourceEventId.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type ParsedLotteryEntryLog = {
  signature: string
  slot: number
  blockTime: number | null
  instructionIndex: number
  eventIndex: number
  instructionKind: SolanaLotteryInstructionKind
  creatorMint: string
  buyerSolana: string
  amountRaw: string
}

export type SolanaLotteryIngestRpc = {
  getGenesisHash(): Promise<string>
  getSignaturesForAddress(
    programId: string,
    opts: { commitment: 'finalized'; limit: number; until?: string; before?: string },
  ): Promise<string[]>
  getParsedTransaction(
    signature: string,
    opts: { commitment: 'finalized'; maxSupportedTransactionVersion: number },
  ): Promise<SolanaParsedTx | null>
}

export type SolanaParsedTx = {
  slot: number
  blockTime: number | null
  meta: {
    logMessages?: string[] | null
    err?: unknown
  } | null
  transaction: {
    message: {
      accountKeys?: Array<{ pubkey?: { toBase58?: () => string } | string } | string>
      instructions?: Array<{
        programId?: { toBase58?: () => string } | string
        programIdIndex?: number
        parsed?: { type?: string }
        data?: string
      }>
    }
  }
}

function pubkeyToString(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (
    typeof value === 'object' &&
    value &&
    'toBase58' in value &&
    typeof (value as { toBase58?: () => string }).toBase58 === 'function'
  ) {
    return String((value as { toBase58: () => string }).toBase58())
  }
  if (typeof value === 'object' && value && 'pubkey' in value) {
    return pubkeyToString((value as { pubkey: unknown }).pubkey)
  }
  return String(value)
}

/**
 * Parse authenticated Anchor events from hook invoke windows only.
 * JSON / marker-based logs are intentionally unsupported.
 */
export function parseLotteryEntryRecordedFromLogs(params: {
  programId: string
  signature: string
  slot: number
  blockTime: number | null
  instructionIndex: number
  logMessages: string[]
}): ParsedLotteryEntryLog[] {
  const windows = decodeHookLotteryEventsFromLogs({
    programId: params.programId,
    logMessages: params.logMessages,
  })
  const out: ParsedLotteryEntryLog[] = []
  let eventIndex = 0
  for (const window of windows) {
    for (const entry of window.entries) {
      out.push({
        signature: params.signature,
        slot: params.slot,
        blockTime: params.blockTime,
        instructionIndex: params.instructionIndex,
        eventIndex,
        instructionKind: window.instructionKind,
        creatorMint: entry.creatorMint,
        buyerSolana: entry.buyerSolana,
        amountRaw: entry.amountRaw,
      })
      eventIndex += 1
    }
  }
  return out
}

/**
 * Drain signatures newer than watermark. Solana returns newest-first pages;
 * when a page is full we page older with `before` until we hit the watermark.
 */
export async function drainSignaturesSinceWatermark(params: {
  rpc: SolanaLotteryIngestRpc
  programId: string
  watermark: string | null
  limit: number
  maxPages?: number
}): Promise<string[]> {
  const maxPages = Math.max(1, params.maxPages ?? 50)
  const newestFirst: string[] = []
  let before: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const batch = await params.rpc.getSignaturesForAddress(params.programId, {
      commitment: 'finalized',
      limit: params.limit,
      until: params.watermark ?? undefined,
      before,
    })
    if (batch.length === 0) break
    newestFirst.push(...batch)
    if (batch.length < params.limit) break
    before = batch[batch.length - 1]
  }
  // Oldest → newest for processing / cursor advancement.
  return newestFirst.reverse()
}

export async function ingestFinalizedLotteryLogs(params: {
  db: Db
  rpc: SolanaLotteryIngestRpc
  programId: string
  cursorKey?: string
  limit?: number
}): Promise<{
  scanned: number
  inserted: number
  skippedReemit: number
  sourceEventIds: string[]
}> {
  const programId = params.programId.trim()
  const cursorKey = params.cursorKey ?? `lottery-ingest:${programId}`
  const limit = Math.max(1, Math.min(params.limit ?? 25, 100))
  const genesis = (await params.rpc.getGenesisHash()).trim()
  if (!genesis) throw new Error('missing_genesis_hash')

  const cursor = await getIngestCursor(params.db, cursorKey)
  const signatures = await drainSignaturesSinceWatermark({
    rpc: params.rpc,
    programId,
    watermark: cursor?.lastSignature ?? null,
    limit,
  })

  let inserted = 0
  let skippedReemit = 0
  const sourceEventIds: string[] = []
  let newestProcessedSig: string | null = null
  let newestProcessedSlot: number | null = null

  for (const signature of signatures) {
    const tx = await params.rpc.getParsedTransaction(signature, {
      commitment: 'finalized',
      maxSupportedTransactionVersion: 0,
    })
    // Unavailable details: stop boundary so this signature retries next poll.
    if (!tx) break

    const slot = tx.slot
    // Failed txs and empty-log successes advance the cursor (no eligibility).
    if (tx.meta?.err) {
      newestProcessedSig = signature
      newestProcessedSlot = slot
      continue
    }

    const logs = Array.isArray(tx.meta?.logMessages) ? tx.meta!.logMessages! : []
    let instructionIndex = 0
    const ixs = tx.transaction.message.instructions ?? []
    for (let i = 0; i < ixs.length; i++) {
      const pid = pubkeyToString(ixs[i]?.programId)
      if (pid === programId) {
        instructionIndex = i
        break
      }
    }

    const parsed = parseLotteryEntryRecordedFromLogs({
      programId,
      signature,
      slot,
      blockTime: tx.blockTime,
      instructionIndex,
      logMessages: logs,
    })

    for (const ev of parsed) {
      const sourceEventId = buildSolanaLotterySourceEventId({
        clusterGenesisHash: genesis,
        programId,
        signature: ev.signature,
        instructionIndex: ev.instructionIndex,
        eventIndex: ev.eventIndex,
      })
      const { inserted: wasInserted } = await upsertSolanaLotteryInboxEvent(params.db, {
        clusterGenesisHash: genesis,
        programId,
        signature: ev.signature,
        instructionIndex: ev.instructionIndex,
        eventIndex: ev.eventIndex,
        instructionKind: ev.instructionKind,
        creatorMint: ev.creatorMint,
        buyerSolana: ev.buyerSolana,
        amountRaw: ev.amountRaw,
        slot: ev.slot,
        blockTime: ev.blockTime ? new Date(ev.blockTime * 1000) : null,
      })
      sourceEventIds.push(sourceEventId)
      if (ev.instructionKind === 'relay_entries_reemit') {
        skippedReemit += 1
      } else if (wasInserted) {
        inserted += 1
      }
    }

    newestProcessedSig = signature
    newestProcessedSlot = slot
  }

  if (newestProcessedSig != null && newestProcessedSlot != null) {
    await advanceIngestCursor({
      db: params.db,
      cursorKey,
      programId,
      lastSignature: newestProcessedSig,
      lastSlot: newestProcessedSlot,
    })
  }

  return {
    scanned: signatures.length,
    inserted,
    skippedReemit,
    sourceEventIds,
  }
}
