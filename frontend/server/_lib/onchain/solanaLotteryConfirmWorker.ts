import {
  listSubmittedSolanaLotteryInboxRows,
  markInboxConfirmed,
  markSubmittedInboxFailed,
  markSubmittedInboxRetryable,
} from './solanaLotteryEntryInbox.js'
import { readSolanaLotteryLzReceipt } from './solanaLotteryLzReceipt.js'
import { PublicKey } from '@solana/web3.js'
import { deriveLotteryOappStoreBytes32 } from './solanaLotteryOappClient.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export async function confirmSolanaLotteryInboxBatch(params: {
  db: Db
  limit?: number
}): Promise<{ checked: number; confirmed: number; retryable: number; failed: number; pending: number; errors: string[] }> {
  const programIdRaw = String(process.env.SOLANA_LOTTERY_OAPP_PROGRAM_ID ?? '').trim()
  let senderBytes32: string
  try {
    senderBytes32 = deriveLotteryOappStoreBytes32(new PublicKey(programIdRaw))
  } catch {
    throw new Error('missing_or_invalid_solana_lottery_oapp_program_id')
  }
  const rows = await listSubmittedSolanaLotteryInboxRows({ db: params.db, limit: params.limit })
  const out = { checked: rows.length, confirmed: 0, retryable: 0, failed: 0, pending: 0, errors: [] as string[] }
  for (const row of rows) {
    try {
      const receipt = await readSolanaLotteryLzReceipt({
        lzGuid: row.lzGuid ?? '',
        senderBytes32,
        sourceTxHash: row.transportSourceTxHash,
      })
      if (receipt.state === 'confirmed') {
        await markInboxConfirmed({ db: params.db, id: row.id, lzGuid: row.lzGuid, baseTxHash: receipt.baseTxHash })
        out.confirmed += 1
      } else if (receipt.state === 'terminal_failed') {
        await markSubmittedInboxFailed({ db: params.db, id: row.id, reason: `layerzero_${receipt.status}:${receipt.reason}` })
        out.failed += 1
      } else if (receipt.state === 'retryable') {
        await markSubmittedInboxRetryable({
          db: params.db,
          id: row.id,
          reason: `layerzero_retryable_${receipt.status}:${receipt.reason}`,
        })
        out.retryable += 1
      } else {
        out.pending += 1
      }
    } catch (error) {
      out.errors.push(`${row.sourceEventId}:${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return out
}
