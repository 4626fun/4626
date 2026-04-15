import type { Hex } from 'viem'

const HEX_STRING_RE = /^0x[0-9a-fA-F]+$/

export function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && HEX_STRING_RE.test(value)
}

export function getHexByteLength(hex: string): number | null {
  if (!hex.startsWith('0x')) return null
  const body = hex.slice(2)
  if (body.length % 2 !== 0) return null
  return body.length / 2
}

export function signatureMeta(signature: Hex) {
  const byteLength = getHexByteLength(signature)
  return {
    signatureLength: signature.length,
    byteLength,
    is64Bytes: byteLength === 64,
    is65Bytes: byteLength === 65,
  }
}

export function isUserOpHashLike(value: unknown): boolean {
  return isHexString(value) && value.length === 66
}

type SignatureExtraction = { signature: Hex | null; source: string | null }

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

export function ensureSignatureHex(
  value: unknown,
  context: string,
  onExtracted?: (signature: Hex, source: string | null) => void,
): Hex {
  const { signature, source } = extractSignatureHex(value)
  if (!signature) {
    throw new Error(`Invalid signature returned from ${context}`)
  }
  onExtracted?.(signature, source)
  return signature
}

export function runSignatureExtractionHarness() {
  const sig65 = `0x${'11'.repeat(65)}`
  const sig64 = `0x${'22'.repeat(64)}`
  const cases = [
    { name: 'raw string', input: sig65 },
    { name: 'object signature', input: { signature: sig65, encoding: 'hex' } },
    { name: 'nested data signature', input: { data: { signature: sig65 } } },
    { name: 'nested result signature (64-byte)', input: { result: { signature: sig64 } } },
  ]
  return cases.map((t) => {
    const { signature, source } = extractSignatureHex(t.input)
    if (!signature) {
      return {
        name: t.name,
        ok: false,
        source,
        signatureLength: null,
        byteLength: null,
      }
    }
    const meta = signatureMeta(signature)
    return {
      name: t.name,
      ok: Boolean(signature),
      source,
      signatureLength: meta.signatureLength,
      byteLength: meta.byteLength,
    }
  })
}
