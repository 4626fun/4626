/**
 * Solana lottery finalized-log ingest action (not registered on orchestrator).
 *
 * Fail-closed by default. Does not enable relay, clear the ring buffer, or
 * submit to Base. Ring buffer is never treated as the sole eligibility source.
 */

import {
  assessSolanaLotteryLzTransportReadiness,
  SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE,
  truthyEnv,
} from '../utils/solanaLotteryLzTransport.js'

export type SolanaLotteryIngestResult = {
  ok: true
  mode: 'dry_run' | 'disabled'
  reason: string
  transport: ReturnType<typeof assessSolanaLotteryLzTransportReadiness>
}

/**
 * Ingest is intentionally a no-op until explicitly enabled AND transport
 * design is accepted. Default: report disabled and leave inbox untouched.
 */
export async function executeSolanaLotteryIngest(
  _payload: Record<string, unknown> = {},
): Promise<SolanaLotteryIngestResult> {
  const transport = assessSolanaLotteryLzTransportReadiness()

  // Hard reject if someone tries to use retired Twin defaults.
  if (transport.reasons.includes('retired_twin_adapter_configured')) {
    throw new Error(`${SOLANA_LOTTERY_LZ_TRANSPORT_UNAVAILABLE}:retired_twin_adapter_configured`)
  }

  if (!truthyEnv(process.env.SOLANA_LOTTERY_INGEST_ENABLED)) {
    return {
      ok: true,
      mode: 'disabled',
      reason: 'SOLANA_LOTTERY_INGEST_ENABLED not set',
      transport,
    }
  }

  // Even when ingest env is on, keep fail-closed until a separate ops
  // authorization wires DB+RPC (this PR ships the modules + tests only).
  return {
    ok: true,
    mode: 'dry_run',
    reason: 'ingest_modules_ready_live_rpc_not_authorized',
    transport,
  }
}
