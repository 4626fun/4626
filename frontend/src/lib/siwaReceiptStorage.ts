const SIWA_RECEIPT_KEY = 'cv_siwa_receipt'
const SIWA_RECEIPT_EXPIRES_AT_KEY = 'cv_siwa_receipt_expires_at'

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

function parseExpiresAt(value: string): number | null {
  const ms = Date.parse(value)
  if (!Number.isFinite(ms) || ms <= 0) return null
  return ms
}

export function clearStoredSiwaReceipt(): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.removeItem(SIWA_RECEIPT_KEY)
    sessionStorage.removeItem(SIWA_RECEIPT_EXPIRES_AT_KEY)
  } catch {
    // ignore storage errors
  }
}

export function setStoredSiwaReceipt(params: { receipt: string; expiresAt: string }): void {
  if (!canUseSessionStorage()) return
  const receipt = String(params.receipt ?? '').trim()
  const expiresAt = String(params.expiresAt ?? '').trim()
  const expiresAtMs = parseExpiresAt(expiresAt)
  if (!receipt || !expiresAtMs) return
  try {
    sessionStorage.setItem(SIWA_RECEIPT_KEY, receipt)
    sessionStorage.setItem(SIWA_RECEIPT_EXPIRES_AT_KEY, new Date(expiresAtMs).toISOString())
  } catch {
    // ignore storage errors
  }
}

export function getStoredSiwaReceipt(): string | null {
  if (!canUseSessionStorage()) return null
  try {
    const receipt = String(sessionStorage.getItem(SIWA_RECEIPT_KEY) ?? '').trim()
    const expiresAtRaw = String(sessionStorage.getItem(SIWA_RECEIPT_EXPIRES_AT_KEY) ?? '').trim()
    const expiresAtMs = parseExpiresAt(expiresAtRaw)
    if (!receipt || !expiresAtMs) {
      clearStoredSiwaReceipt()
      return null
    }
    if (Date.now() >= expiresAtMs) {
      clearStoredSiwaReceipt()
      return null
    }
    return receipt
  } catch {
    return null
  }
}

