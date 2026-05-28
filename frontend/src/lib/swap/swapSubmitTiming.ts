export type SwapSubmitTimingPhase =
  | 'submit_start'
  | 'submit_session'
  | 'submit_7702_dry_run'
  | 'submit_balance_preflight'
  | 'submit_zora_pending_wait'
  | 'submit_zora_prepare'
  | 'submit_send'
  | 'aa_entry'
  | 'aa_preflight'
  | 'aa_bundler_probe'
  | 'aa_owner_nonce_balance'
  | 'aa_zora_assert'
  | 'aa_gas_estimate'
  | 'aa_sign'
  | 'aa_bundler_submit'
  | 'aa_send'

export type SwapSubmitTimingReport = {
  startedAt: number
  phases: Array<{ phase: SwapSubmitTimingPhase; at: number; deltaMs: number }>
  totalMs: number
}

export type SwapSubmitTimingCollector = {
  mark: (phase: SwapSubmitTimingPhase) => void
  getReport: () => SwapSubmitTimingReport
}

export function createSwapSubmitTiming(): SwapSubmitTimingCollector {
  const startedAt = performance.now()
  let lastAt = startedAt
  const phases: SwapSubmitTimingReport['phases'] = []

  return {
    mark(phase) {
      const at = performance.now()
      phases.push({
        phase,
        at,
        deltaMs: Math.round(at - lastAt),
      })
      lastAt = at
    },
    getReport() {
      const end = performance.now()
      return {
        startedAt,
        phases,
        totalMs: Math.round(end - startedAt),
      }
    },
  }
}
