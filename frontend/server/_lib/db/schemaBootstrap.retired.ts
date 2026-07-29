/**
 * Retired feature bootstrap stubs (2026-07-29).
 * Import these instead of schemaBootstrap ensure* for telegram / inverse / counter-trade.
 * schemaBootstrap.ts keep exports stable; call sites that still import from schemaBootstrap
 * should switch to these no-ops or rely on the patched functions below.
 */

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export async function ensureTelegramTradingSchema(_db: Db): Promise<void> {
  // retired — tables dropped; do not re-bootstrap
}

export async function ensureAlfaclubCounterTradeSchema(_db: Db): Promise<void> {
  // retired
}

export async function ensureAlfaclubDecisionLedgerSchema(_db: Db): Promise<void> {
  // retired
}

export async function ensureAlfaclubInverseOpinionTradeSchema(_db: Db): Promise<void> {
  // retired — prevents strict+verifyRecorded cold-start throw after DROP
}
