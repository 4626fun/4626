// Signature and error helpers extracted from DeployVault.tsx.
// These are side-effect free apart from optional logger calls gated on the
// `aaDebug` mode set by the host component at module-init time.

import type { Hex } from 'viem'

import { logger } from '@/lib/observability/logger'

import { getHexByteLength, isHexString } from './deployVaultHelpers'

let aaDebug = false

/** Host component calls this once at init to route debug logs through the shared logger. */
export function setAaDebugMode(enabled: boolean): void {
  aaDebug = Boolean(enabled)
}

export type SignatureMeta = {
  signatureLength: number
  byteLength: number | null
  is64Bytes: boolean
  is65Bytes: boolean
}

export function signatureMeta(signature: Hex): SignatureMeta {
  const byteLength = getHexByteLength(signature)
  return {
    signatureLength: signature.length,
    byteLength,
    is64Bytes: byteLength === 64,
    is65Bytes: byteLength === 65,
  }
}

export function logNonEoaSignature(signature: Hex, context: string): SignatureMeta {
  const meta = signatureMeta(signature)
  if (meta.byteLength !== 65 && aaDebug) {
    logger.warn('[DeployVault] Non-EOA signature detected', {
      context,
      ...meta,
    })
  }
  return meta
}

export type SignatureExtraction = { signature: Hex | null; source: string | null }

export function extractSignatureHex(value: unknown, depth = 0): SignatureExtraction {
  if (isHexString(value)) {
    return { signature: value as Hex, source: depth === 0 ? 'string' : `nested.${depth}` }
  }
  if (!value || typeof value !== 'object' || depth > 2) {
    return { signature: null, source: null }
  }
  const record = value as Record<string, unknown>
  const direct = record.signature ?? record.sig
  if (isHexString(direct)) {
    return { signature: direct as Hex, source: 'object.signature' }
  }
  const candidates: Array<[string, unknown]> = [
    ['data', record.data],
    ['result', record.result],
    ['response', record.response],
    ['signature', record.signature],
    ['sig', record.sig],
  ]
  for (const [key, candidate] of candidates) {
    if (isHexString(candidate)) {
      return { signature: candidate as Hex, source: `object.${key}` }
    }
    if (candidate && typeof candidate === 'object') {
      const nested = extractSignatureHex(candidate, depth + 1)
      if (nested.signature) {
        return { signature: nested.signature, source: `object.${key}.${nested.source ?? 'nested'}` }
      }
    }
  }
  return { signature: null, source: null }
}

export function ensureSignatureHex(value: unknown, context: string): Hex {
  const { signature, source } = extractSignatureHex(value)
  if (!signature) {
    throw new Error(`Invalid signature returned from ${context}`)
  }
  if (aaDebug) {
    logger.debug(`[DeployVault] ${context} signature`, {
      source: source ?? 'unknown',
      ...signatureMeta(signature),
    })
  }
  return signature
}

export function debugSignatureReady(
  context: string,
  signature: Hex,
  details?: Record<string, unknown>,
): void {
  if (!aaDebug) return
  logger.debug('[DeployVault] UserOp signature ready', {
    context,
    ...signatureMeta(signature),
    ...(details ?? {}),
  })
}

export function isUserRejectedErrorMessage(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lower = msg.toLowerCase()
  return (
    lower.includes('user rejected') ||
    lower.includes('rejected the request') ||
    lower.includes('action_rejected') ||
    lower.includes('user denied') ||
    lower.includes('user cancelled')
  )
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || ''
  return String((error as { message?: unknown } | null)?.message ?? error ?? '')
}

export function isTransientRpcFailure(error: unknown): boolean {
  const lower = errorMessage(error).toLowerCase()
  const code = Number(
    (error as { code?: unknown; cause?: { code?: unknown } } | null)?.code ??
      (error as { code?: unknown; cause?: { code?: unknown } } | null)?.cause?.code ??
      NaN,
  )
  if (code === 429 || code === -32016 || code === -32011) return true
  return (
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('over rate limit') ||
    lower.includes('rate limit') ||
    lower.includes('requested resource not available') ||
    lower.includes('resource not available') ||
    lower.includes('no backend is currently healthy') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('network error') ||
    lower.includes('failed to fetch')
  )
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
