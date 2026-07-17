/**
 * Solana lottery LZ submit action (not registered on orchestrator).
 *
 * Always fail-closed unless SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1 and
 * SOLANA_LOTTERY_LZ_TRANSPORT_READY=1 with a configured OApp peer.
 * Never calls processSwapLottery / Twin adapter.
 */

import {
  assessSolanaLotteryLzTransportReadiness,
  SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
  submitSolanaLotteryEntryViaLz,
  submitSolanaLotteryWinnerViaLz,
  truthyEnv,
} from '../utils/solanaLotteryLzTransport.js'

export async function executeSolanaLotterySubmit(
  _payload: Record<string, unknown> = {},
): Promise<never> {
  if (truthyEnv(process.env.SOLANA_LOTTERY_ALLOW_EOA_PROCESS_SWAP)) {
    throw new Error(SOLANA_LOTTERY_EOA_SUBMIT_FORBIDDEN)
  }

  const readiness = assessSolanaLotteryLzTransportReadiness()
  if (!readiness.relayEntriesEnabled) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:relay_flag_disabled`)
  }
  if (!readiness.ready) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:${readiness.reasons.join(',')}`)
  }

  // Ready env path still has no live OApp send implementation.
  await submitSolanaLotteryEntryViaLz({
    sourceEventId: 'dry-run',
    buyer: '0x0000000000000000000000000000000000000001',
    tokenIn: '0x0000000000000000000000000000000000000002',
    amount: 1n,
  })
  throw new Error(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)
}

export async function executeSolanaLotteryWinnerRelay(
  payload: Record<string, unknown> = {},
): Promise<never> {
  const winId = typeof payload.winId === 'string' ? payload.winId : ''
  const creatorMint = typeof payload.creatorMint === 'string' ? payload.creatorMint : ''
  const winnerSolana = typeof payload.winnerSolana === 'string' ? payload.winnerSolana : ''
  const sharesPaid = typeof payload.sharesPaid === 'string' || typeof payload.sharesPaid === 'number'
    ? BigInt(payload.sharesPaid)
    : 0n

  if (!winId || !creatorMint || !winnerSolana) {
    throw new Error('winner_relay_invalid_payload')
  }
  // Strict u64: reject oversized payouts (preserve SOL-P1-03).
  if (sharesPaid < 0n || sharesPaid > 0xffffffffffffffffn) {
    throw new Error('winner_relay_shares_paid_overflow')
  }

  await submitSolanaLotteryWinnerViaLz({
    winId,
    creatorMint,
    winnerSolana,
    sharesPaid,
  })
  throw new Error(SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE)
}
