declare const process: { env: Record<string, string | undefined> }

export const INVERSE_OPINION_TRADE_CAPTURE_ENV =
  'ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED'

export function isInverseOpinionTradeCaptureEnabled(): boolean {
  const raw = String(process.env[INVERSE_OPINION_TRADE_CAPTURE_ENV] ?? '')
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}
