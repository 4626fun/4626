export type XmtpEnv = 'production' | 'dev' | 'local'

export const ENC_KEY_HEX_RE = /^0x[0-9a-fA-F]{64}$/

export type StoredInstallationMeta = {
  inboxId: string
  installationId: string
  updatedAt: number
}

const inMemoryEncKeys = new Map<string, string>()

function encKeyStorageKey(env: XmtpEnv, address: string): string {
  return `cv:xmtp:encKey:${env}:${address.toLowerCase()}`
}

function installationProvisionedStorageKey(env: XmtpEnv, address: string): string {
  return `cv:xmtp:installationProvisioned:${env}:${address.toLowerCase()}`
}

function installationMetaStorageKey(env: XmtpEnv, address: string): string {
  return `cv:xmtp:installationMeta:${env}:${address.toLowerCase()}`
}

export function buildXmtpDbPath(env: XmtpEnv, inboxId: string): string {
  return `xmtp-${env}-${inboxId}.db3`
}

export function readStoredEncKeyHex(env: XmtpEnv, address: string): string | null {
  const key = encKeyStorageKey(env, address)
  const fromMemory = inMemoryEncKeys.get(key) ?? null
  if (fromMemory && ENC_KEY_HEX_RE.test(fromMemory)) return fromMemory

  if (typeof window === 'undefined') return null
  try {
    const fromStorage = window.localStorage.getItem(key)
    if (!fromStorage || !ENC_KEY_HEX_RE.test(fromStorage)) return null
    inMemoryEncKeys.set(key, fromStorage)
    return fromStorage
  } catch {
    return null
  }
}

export function writeStoredEncKeyHex(env: XmtpEnv, address: string, encKeyHex: string): void {
  if (!ENC_KEY_HEX_RE.test(encKeyHex)) return
  const key = encKeyStorageKey(env, address)
  inMemoryEncKeys.set(key, encKeyHex)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, encKeyHex)
  } catch {
    // ignore storage errors
  }
}

export function clearStoredEncKeyHex(env: XmtpEnv, address: string): void {
  const key = encKeyStorageKey(env, address)
  inMemoryEncKeys.delete(key)
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore storage errors
  }
}

export function readInstallationProvisioned(env: XmtpEnv, address: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(installationProvisionedStorageKey(env, address)) === '1'
  } catch {
    return false
  }
}

export function writeInstallationProvisioned(env: XmtpEnv, address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(installationProvisionedStorageKey(env, address), '1')
  } catch {
    // ignore storage errors
  }
}

export function clearInstallationProvisioned(env: XmtpEnv, address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(installationProvisionedStorageKey(env, address))
  } catch {
    // ignore storage errors
  }
}

export function readStoredInstallationMeta(
  env: XmtpEnv,
  address: string,
): StoredInstallationMeta | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(installationMetaStorageKey(env, address))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredInstallationMeta> | null
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.inboxId !== 'string' || !parsed.inboxId.trim()) return null
    if (typeof parsed.installationId !== 'string' || !parsed.installationId.trim()) return null
    return {
      inboxId: parsed.inboxId.trim(),
      installationId: parsed.installationId.trim(),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function writeStoredInstallationMeta(
  env: XmtpEnv,
  address: string,
  meta: Pick<StoredInstallationMeta, 'inboxId' | 'installationId'>,
): void {
  if (typeof window === 'undefined') return
  const payload: StoredInstallationMeta = {
    inboxId: meta.inboxId.trim(),
    installationId: meta.installationId.trim(),
    updatedAt: Date.now(),
  }
  if (!payload.inboxId || !payload.installationId) return
  try {
    window.localStorage.setItem(installationMetaStorageKey(env, address), JSON.stringify(payload))
  } catch {
    // ignore storage errors
  }
}

export function clearStoredInstallationMeta(env: XmtpEnv, address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(installationMetaStorageKey(env, address))
  } catch {
    // ignore storage errors
  }
}

export function hasKnownXmtpInstallation(env: XmtpEnv, address: string): boolean {
  return readInstallationProvisioned(env, address) || readStoredInstallationMeta(env, address) !== null
}
