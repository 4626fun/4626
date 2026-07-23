import { PublicKey } from '@solana/web3.js'

export type SolanaLotteryLzReceipt =
  | { state: 'pending'; status: string; baseTxHash: null }
  | { state: 'confirmed'; status: 'DELIVERED'; baseTxHash: string }
  | { state: 'retryable'; status: string; baseTxHash: string | null; reason: string }
  | { state: 'terminal_failed'; status: string; baseTxHash: string | null; reason: string }

type ScanMessage = {
  guid?: unknown
  pathway?: {
    srcEid?: unknown
    dstEid?: unknown
    sender?: { address?: unknown }
  }
  source?: { tx?: { txHash?: unknown } }
  destination?: { status?: unknown; tx?: { txHash?: unknown } }
  status?: { name?: unknown; message?: unknown }
}

// FAILED execution is retryable from the already-verified destination packet.
// BLOCKED requires configuration repair, but must not cause an origin resend.
const RETRYABLE_STATUSES = new Set(['FAILED', 'BLOCKED', 'PAYLOAD_STORED'])
const TERMINAL_STATUSES = new Set([
  'APPLICATION_BURNED', 'APPLICATION_SKIPPED',
  'UNRESOLVABLE_COMMAND', 'MALFORMED_COMMAND',
])
const RETRYABLE_DESTINATION_STATUSES = new Set(['FAILED', 'SIMULATION_REVERTED', 'PAYLOAD_STORED'])

function scanBaseUrl(): string {
  return String(process.env.SOLANA_LOTTERY_LZ_SCAN_URL ?? 'https://scan.layerzero-api.com/v1')
    .trim().replace(/\/$/, '')
}

function expectedSenderForms(senderBytes32: string): Set<string> {
  const hex = senderBytes32.toLowerCase()
  const bytes = Buffer.from(hex.slice(2), 'hex')
  return new Set([hex, new PublicKey(bytes).toBase58()])
}

export async function readSolanaLotteryLzReceipt(params: {
  lzGuid: string
  senderBytes32: string
  sourceTxHash?: string | null
  fetchImpl?: typeof fetch
}): Promise<SolanaLotteryLzReceipt> {
  const guid = params.lzGuid.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(guid)) throw new Error('invalid_lz_guid')
  if (!/^0x[a-fA-F0-9]{64}$/.test(params.senderBytes32)) throw new Error('invalid_oapp_sender')

  const response = await (params.fetchImpl ?? fetch)(`${scanBaseUrl()}/messages/guid/${guid}`, {
    headers: { accept: 'application/json' },
  })
  if (response.status === 404) return { state: 'pending', status: 'NOT_INDEXED', baseTxHash: null }
  if (!response.ok) throw new Error(`layerzero_scan_http_${response.status}`)
  const json = await response.json() as { data?: unknown }
  const rows = Array.isArray(json.data) ? json.data as ScanMessage[] : []
  const message = rows.find((row) => String(row.guid ?? '').toLowerCase() === guid)
  if (!message) return { state: 'pending', status: 'NOT_INDEXED', baseTxHash: null }

  if (Number(message.pathway?.srcEid) !== 30168 || Number(message.pathway?.dstEid) !== 30184) {
    throw new Error('layerzero_receipt_pathway_mismatch')
  }
  const sender = String(message.pathway?.sender?.address ?? '').trim()
  const expectedSenders = expectedSenderForms(params.senderBytes32)
  if (!expectedSenders.has(sender) && !expectedSenders.has(sender.toLowerCase())) {
    throw new Error('layerzero_receipt_sender_mismatch')
  }
  const sourceTxHash = String(message.source?.tx?.txHash ?? '').trim()
  if (params.sourceTxHash && sourceTxHash !== params.sourceTxHash) {
    throw new Error('layerzero_receipt_source_tx_mismatch')
  }

  const status = String(message.status?.name ?? 'UNKNOWN').trim().toUpperCase()
  const destinationStatus = String(message.destination?.status ?? '').trim().toUpperCase()
  const baseTxHash = String(message.destination?.tx?.txHash ?? '').trim()
  if (status === 'DELIVERED' && destinationStatus === 'SUCCEEDED') {
    if (!/^0x[a-fA-F0-9]{64}$/.test(baseTxHash)) throw new Error('layerzero_receipt_missing_base_tx')
    return { state: 'confirmed', status: 'DELIVERED', baseTxHash }
  }
  const failure = {
    status: status || destinationStatus,
    baseTxHash: /^0x[a-fA-F0-9]{64}$/.test(baseTxHash) ? baseTxHash : null,
    reason: String(message.status?.message ?? (destinationStatus || status)).slice(0, 300),
  }
  if (TERMINAL_STATUSES.has(status)) {
    return {
      state: 'terminal_failed',
      ...failure,
    }
  }
  if (RETRYABLE_STATUSES.has(status) || RETRYABLE_DESTINATION_STATUSES.has(destinationStatus)) {
    return { state: 'retryable', ...failure }
  }
  return { state: 'pending', status: status || 'INFLIGHT', baseTxHash: null }
}
