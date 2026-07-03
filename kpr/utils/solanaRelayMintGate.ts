function parseOrchestratorEnvFlag(raw: string | undefined): boolean | null {
  const normalized = String(raw ?? '').trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
  return null
}

function isSolanaAddress(value: string): boolean {
  const s = value.trim()
  return s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function parseMintList(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter((v) => isSolanaAddress(v))
}

/**
 * When SOLANA_RELAY_PER_MINT_GATING=1, relay_entries only processes mints listed in
 * SOLANA_RELAY_ENABLED_MINTS. Global SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED must
 * still be truthy — this gate is an additional per-creator allowlist.
 */
export function isMintRelayEnabled(mintStr: string): boolean {
  const perMintGating = parseOrchestratorEnvFlag(process.env.SOLANA_RELAY_PER_MINT_GATING)
  if (perMintGating !== true) return true
  const enabledMints = parseMintList(String(process.env.SOLANA_RELAY_ENABLED_MINTS ?? ''))
  return enabledMints.includes(mintStr.trim())
}
