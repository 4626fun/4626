/**
 * Authenticated Anchor event decode for creator-share-hook lottery logs.
 *
 * Only `Program data:` base64 payloads with matching event discriminators
 * inside the hook program's invoke window are accepted. JSON log fixtures
 * and other programs' logs are rejected.
 */

import { createHash } from 'node:crypto'
import { PublicKey } from '@solana/web3.js'

import type { SolanaLotteryInstructionKind } from './solanaLotteryEntryInbox.js'

export type DecodedLotteryEntryRecorded = {
  creatorMint: string
  buyerSolana: string
  amountRaw: string
  slot: bigint
  bufferCount: number
}

export type DecodedHookWindowEvent = {
  instructionKind: SolanaLotteryInstructionKind
  entries: DecodedLotteryEntryRecorded[]
}

const PROGRAM_DATA_PREFIX = 'Program data: '
const INVOKE_RE = /^Program (\S+) invoke \[(\d+)\]/
const SUCCESS_RE = /^Program (\S+) success/
const FAILED_RE = /^Program (\S+) failed/

function eventDiscriminator(name: string): Buffer {
  return createHash('sha256').update(`event:${name}`).digest().subarray(0, 8)
}

const LOTTERY_ENTRY_DISC = eventDiscriminator('LotteryEntryRecorded')
const ENTRIES_RELAYED_DISC = eventDiscriminator('EntriesRelayed')

export function lotteryEntryRecordedDiscriminator(): Buffer {
  return Buffer.from(LOTTERY_ENTRY_DISC)
}

export function entriesRelayedDiscriminator(): Buffer {
  return Buffer.from(ENTRIES_RELAYED_DISC)
}

function readU64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset)
}

function readU32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset)
}

function pubkeyBase58(buf: Buffer, offset: number): string {
  return new PublicKey(buf.subarray(offset, offset + 32)).toBase58()
}

/** Encode a LotteryEntryRecorded event payload (discriminator + body) as base64 for tests. */
export function encodeLotteryEntryRecordedProgramData(params: {
  creatorMint: PublicKey | string
  buyer: PublicKey | string
  amount: bigint | number
  slot: bigint | number
  bufferCount: number
}): string {
  const creator =
    typeof params.creatorMint === 'string' ? new PublicKey(params.creatorMint) : params.creatorMint
  const buyer = typeof params.buyer === 'string' ? new PublicKey(params.buyer) : params.buyer
  const body = Buffer.alloc(8 + 32 + 32 + 8 + 8 + 4)
  LOTTERY_ENTRY_DISC.copy(body, 0)
  Buffer.from(creator.toBytes()).copy(body, 8)
  Buffer.from(buyer.toBytes()).copy(body, 40)
  body.writeBigUInt64LE(BigInt(params.amount), 72)
  body.writeBigUInt64LE(BigInt(params.slot), 80)
  body.writeUInt32LE(params.bufferCount >>> 0, 88)
  return body.toString('base64')
}

export function encodeEntriesRelayedProgramData(params: {
  creatorMint: PublicKey | string
  count: number
  overflowCount: bigint | number
}): string {
  const creator =
    typeof params.creatorMint === 'string' ? new PublicKey(params.creatorMint) : params.creatorMint
  const body = Buffer.alloc(8 + 32 + 4 + 8)
  ENTRIES_RELAYED_DISC.copy(body, 0)
  Buffer.from(creator.toBytes()).copy(body, 8)
  body.writeUInt32LE(params.count >>> 0, 40)
  body.writeBigUInt64LE(BigInt(params.overflowCount), 44)
  return body.toString('base64')
}

export function decodeAnchorEventPayload(base64: string):
  | { kind: 'LotteryEntryRecorded'; event: DecodedLotteryEntryRecorded }
  | { kind: 'EntriesRelayed'; creatorMint: string; count: number; overflowCount: bigint }
  | null {
  let buf: Buffer
  try {
    buf = Buffer.from(base64.trim(), 'base64')
  } catch {
    return null
  }
  if (buf.length < 8) return null
  const disc = buf.subarray(0, 8)
  if (disc.equals(LOTTERY_ENTRY_DISC)) {
    if (buf.length < 8 + 32 + 32 + 8 + 8 + 4) return null
    const amount = readU64LE(buf, 72)
    if (amount <= 0n) return null
    return {
      kind: 'LotteryEntryRecorded',
      event: {
        creatorMint: pubkeyBase58(buf, 8),
        buyerSolana: pubkeyBase58(buf, 40),
        amountRaw: amount.toString(10),
        slot: readU64LE(buf, 80),
        bufferCount: readU32LE(buf, 88),
      },
    }
  }
  if (disc.equals(ENTRIES_RELAYED_DISC)) {
    if (buf.length < 8 + 32 + 4 + 8) return null
    return {
      kind: 'EntriesRelayed',
      creatorMint: pubkeyBase58(buf, 8),
      count: readU32LE(buf, 40),
      overflowCount: readU64LE(buf, 44),
    }
  }
  return null
}

/**
 * Walk logs with an invoke stack; only decode Program data while `programId`
 * is on the stack. Windows containing EntriesRelayed are relay re-emits.
 */
export function decodeHookLotteryEventsFromLogs(params: {
  programId: string
  logMessages: string[]
}): DecodedHookWindowEvent[] {
  const programId = params.programId.trim()
  const stack: string[] = []
  const out: DecodedHookWindowEvent[] = []
  let active: {
    depth: number
    entries: DecodedLotteryEntryRecorded[]
    sawEntriesRelayed: boolean
  } | null = null

  const closeActive = () => {
    if (!active) return
    if (active.entries.length > 0 || active.sawEntriesRelayed) {
      out.push({
        instructionKind: active.sawEntriesRelayed ? 'relay_entries_reemit' : 'buy_path',
        entries: active.entries,
      })
    }
    active = null
  }

  for (const rawLine of params.logMessages) {
    const line = String(rawLine ?? '')
    const invoke = line.match(INVOKE_RE)
    if (invoke) {
      const pid = invoke[1]
      stack.push(pid)
      if (pid === programId && !active) {
        active = { depth: stack.length, entries: [], sawEntriesRelayed: false }
      }
      continue
    }

    const success = line.match(SUCCESS_RE)
    const failed = line.match(FAILED_RE)
    if (success || failed) {
      const pid = (success ?? failed)![1]
      while (stack.length > 0) {
        const top = stack.pop()
        if (top === pid) break
      }
      if (active && stack.length < active.depth) {
        closeActive()
      }
      continue
    }

    if (!active) continue
    if (!stack.includes(programId)) continue
    if (!line.startsWith(PROGRAM_DATA_PREFIX)) continue
    const decoded = decodeAnchorEventPayload(line.slice(PROGRAM_DATA_PREFIX.length).trim())
    if (!decoded) continue
    if (decoded.kind === 'EntriesRelayed') {
      active.sawEntriesRelayed = true
      continue
    }
    active.entries.push(decoded.event)
  }

  closeActive()
  return out
}
