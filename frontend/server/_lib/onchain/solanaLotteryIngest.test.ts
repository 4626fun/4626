import { Keypair } from '@solana/web3.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureSolanaLotteryEntryInboxSchema: vi.fn(async () => {}),
}))

import {
  encodeEntriesRelayedProgramData,
  encodeLotteryEntryRecordedProgramData,
} from './solanaLotteryAnchorEvents.js'
import {
  drainSignaturesSinceWatermark,
  ingestFinalizedLotteryLogs,
  parseLotteryEntryRecordedFromLogs,
} from './solanaLotteryIngest.js'

const PROGRAM = 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU'
const OTHER = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const MINT = Keypair.generate().publicKey
const BUYER = Keypair.generate().publicKey

function hookBuyLogs(amount = 42n) {
  const data = encodeLotteryEntryRecordedProgramData({
    creatorMint: MINT,
    buyer: BUYER,
    amount,
    slot: 100,
    bufferCount: 1,
  })
  return [
    `Program ${PROGRAM} invoke [1]`,
    `Program data: ${data}`,
    `Program ${PROGRAM} success`,
  ]
}

function forgeJsonInOtherProgram() {
  return [
    `Program ${OTHER} invoke [1]`,
    `Program log: LotteryEntryRecorded {"creator_mint":"${MINT.toBase58()}","buyer":"${BUYER.toBase58()}","amount":"999"}`,
    `Program ${OTHER} success`,
    `Program ${PROGRAM} invoke [1]`,
    `Program ${PROGRAM} success`,
  ]
}

describe('solanaLotteryIngest', () => {
  it('decodes authentic Anchor Program data in hook invoke window', () => {
    const parsed = parseLotteryEntryRecordedFromLogs({
      programId: PROGRAM,
      signature: 'sig',
      slot: 9,
      blockTime: null,
      logMessages: hookBuyLogs(10n),
    })
    expect(parsed).toHaveLength(1)
    expect(parsed[0].instructionKind).toBe('buy_path')
    expect(parsed[0].creatorMint).toBe(MINT.toBase58())
    expect(parsed[0].buyerSolana).toBe(BUYER.toBase58())
    expect(parsed[0].amountRaw).toBe('10')
  })

  it('rejects forged JSON from another program', () => {
    const parsed = parseLotteryEntryRecordedFromLogs({
      programId: PROGRAM,
      signature: 'sig',
      slot: 9,
      blockTime: null,
      logMessages: forgeJsonInOtherProgram(),
    })
    expect(parsed).toHaveLength(0)
  })

  it('classifies EntriesRelayed window as relay_entries_reemit', () => {
    const entry = encodeLotteryEntryRecordedProgramData({
      creatorMint: MINT,
      buyer: BUYER,
      amount: 1n,
      slot: 1,
      bufferCount: 0,
    })
    const relayed = encodeEntriesRelayedProgramData({
      creatorMint: MINT,
      count: 1,
      overflowCount: 0,
    })
    const parsed = parseLotteryEntryRecordedFromLogs({
      programId: PROGRAM,
      signature: 'sig',
      slot: 9,
      blockTime: null,
      logMessages: [
        `Program ${PROGRAM} invoke [1]`,
        `Program data: ${entry}`,
        `Program data: ${relayed}`,
        `Program ${PROGRAM} success`,
      ],
    })
    expect(parsed).toHaveLength(1)
    expect(parsed[0].instructionKind).toBe('relay_entries_reemit')
  })

  it('uses stable hook invocation and per-window event indices for CPI buys', () => {
    const first = encodeLotteryEntryRecordedProgramData({
      creatorMint: MINT,
      buyer: BUYER,
      amount: 1n,
      slot: 1,
      bufferCount: 1,
    })
    const second = encodeLotteryEntryRecordedProgramData({
      creatorMint: MINT,
      buyer: BUYER,
      amount: 2n,
      slot: 1,
      bufferCount: 2,
    })
    const parsed = parseLotteryEntryRecordedFromLogs({
      programId: PROGRAM,
      signature: 'sig',
      slot: 9,
      blockTime: null,
      logMessages: [
        `Program ${OTHER} invoke [1]`,
        `Program ${PROGRAM} invoke [2]`,
        `Program data: ${first}`,
        `Program ${PROGRAM} success`,
        `Program ${OTHER} success`,
        `Program ${OTHER} invoke [1]`,
        `Program ${PROGRAM} invoke [2]`,
        `Program data: ${second}`,
        `Program ${PROGRAM} success`,
        `Program ${OTHER} success`,
      ],
    })
    expect(parsed.map(({ instructionIndex, eventIndex, amountRaw }) => ({
      instructionIndex,
      eventIndex,
      amountRaw,
    }))).toEqual([
      { instructionIndex: 0, eventIndex: 0, amountRaw: '1' },
      { instructionIndex: 1, eventIndex: 0, amountRaw: '2' },
    ])
  })

  it('drains backlog across multiple signature pages', async () => {
    const pages: Record<string, string[]> = {
      tip: ['sig5', 'sig4'],
      before_sig4: ['sig3', 'sig2'],
      before_sig2: ['sig1'],
    }
    const rpc = {
      getGenesisHash: async () => 'gen',
      getSignaturesForAddress: async (
        _pid: string,
        opts: { before?: string; until?: string; limit: number },
      ) => {
        if (!opts.before) return pages.tip.slice(0, opts.limit)
        if (opts.before === 'sig4') return pages.before_sig4.slice(0, opts.limit)
        if (opts.before === 'sig2') return pages.before_sig2.slice(0, opts.limit)
        return []
      },
      getParsedTransaction: async () => null,
    }
    const drained = await drainSignaturesSinceWatermark({
      rpc,
      programId: PROGRAM,
      watermark: 'old',
      limit: 2,
    })
    expect(drained).toEqual(['sig1', 'sig2', 'sig3', 'sig4', 'sig5'])
  })

  it('fails closed instead of returning a truncated backlog at an explicit page cap', async () => {
    const rpc = {
      getGenesisHash: async () => 'gen',
      getSignaturesForAddress: async () => ['sig2', 'sig1'],
      getParsedTransaction: async () => null,
    }
    await expect(drainSignaturesSinceWatermark({
      rpc,
      programId: PROGRAM,
      watermark: 'old',
      limit: 2,
      maxPages: 1,
    })).rejects.toThrow('solana_lottery_backlog_page_cap_reached')
  })

  it('fails closed when pagination before cursor stalls', async () => {
    const rpc = {
      getGenesisHash: async () => 'gen',
      getSignaturesForAddress: async () => ['sig2', 'sig1'],
      getParsedTransaction: async () => null,
    }
    await expect(drainSignaturesSinceWatermark({
      rpc,
      programId: PROGRAM,
      watermark: 'old',
      limit: 2,
      maxPages: 3,
    })).rejects.toThrow('solana_lottery_backlog_pagination_stalled')
  })

  it('ingests authenticated events and advances cursor; ignores forge JSON', async () => {
    const upserts: unknown[] = []
    let advanced: { sig: string; slot: number } | null = null
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?')
        if (sql.includes('solana_lottery_ingest_cursor') && sql.includes('SELECT')) {
          return { rows: [] }
        }
        if (sql.includes('INSERT INTO solana_lottery_entry_inbox')) {
          upserts.push(values)
          return {
            rows: [
              {
                id: upserts.length,
                source_event_id: `gen:${PROGRAM}:sig1:0:0`,
                cluster_genesis_hash: 'gen',
                program_id: PROGRAM,
                signature: 'sig1',
                instruction_index: 0,
                event_index: 0,
                instruction_kind: 'buy_path',
                creator_mint: MINT.toBase58(),
                buyer_solana: BUYER.toBase58(),
                amount_raw: '42',
                slot: 100,
                block_time: null,
                commitment: 'finalized',
                status: 'pending',
                coverage_share_balance: '0',
                attempt_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                inserted: true,
              },
            ],
          }
        }
        if (sql.includes('INSERT INTO solana_lottery_ingest_cursor')) {
          advanced = { sig: String(values[2]), slot: Number(values[3]) }
          return { rows: [] }
        }
        return { rows: [] }
      }),
    }

    const rpc = {
      getGenesisHash: async () => 'gen',
      getSignaturesForAddress: async () => ['sigForge', 'sig1'],
      getParsedTransaction: async (signature: string) => {
        if (signature === 'sigForge') {
          return {
            slot: 99,
            blockTime: null,
            meta: { err: null, logMessages: forgeJsonInOtherProgram() },
            transaction: { message: { instructions: [{ programId: PROGRAM }] } },
          }
        }
        return {
          slot: 100,
          blockTime: null,
          meta: { err: null, logMessages: hookBuyLogs(42n) },
          transaction: { message: { instructions: [{ programId: PROGRAM }] } },
        }
      },
    }

    const result = await ingestFinalizedLotteryLogs({
      db,
      rpc,
      programId: PROGRAM,
      limit: 10,
    })
    expect(result.inserted).toBe(1)
    expect(result.scanned).toBe(2)
    // Cursor advances to newest successfully fetched signature in the drained set.
    expect(advanced).toEqual({ sig: 'sigForge', slot: 99 })
  })

  it('stops cursor advancement when transaction fetch returns null', async () => {
    let advanced = false
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('?')
        if (sql.includes('SELECT') && sql.includes('cursor')) return { rows: [] }
        if (sql.includes('INSERT INTO solana_lottery_ingest_cursor')) {
          advanced = true
          return { rows: [] }
        }
        return { rows: [] }
      }),
    }
    const rpc = {
      getGenesisHash: async () => 'gen',
      getSignaturesForAddress: async () => ['sigMissing'],
      getParsedTransaction: async () => null,
    }
    const result = await ingestFinalizedLotteryLogs({ db, rpc, programId: PROGRAM })
    expect(result.inserted).toBe(0)
    expect(advanced).toBe(false)
  })
})
