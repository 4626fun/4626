import { bytesToHex, encodeAbiParameters, hexToBytes, type Hex } from 'viem'

import {
  encodeWebAuthnAuthSignature,
  parseDerEcdsaSignature as parseDerEcdsaSignatureBytes,
} from '@/lib/aa/passkeyUserOp'

const SIGNATURE_WRAPPER_ABI = [{ type: 'uint256' }, { type: 'bytes' }] as const

type ParsedKeysAssertion = {
  challengeHex: Hex
  authenticatorDataHex: Hex
  signatureDerHex: Hex
  clientDataJSON: string
  credentialIdHex: Hex | null
}

export type KeysCoinbasePasteResponse = ParsedKeysAssertion

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (normalized.length % 4)) % 4
  const padded = normalized + '='.repeat(padLen)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function readClipboardJsonBlock(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Pasted response is empty.')
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object found in pasted response.')
  return trimmed.slice(start, end + 1)
}

function tryNormalizeJsObjectLiteralToJson(input: string): string {
  const withQuotedKeys = input.replace(
    /([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g,
    '$1"$2"$3',
  )
  // DevTools object-copy often uses single-quoted strings; convert these to JSON strings.
  return withQuotedKeys.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, group: string) => {
    const escaped = group.replace(/"/g, '\\"')
    return `"${escaped}"`
  })
}

function parseHex(value: unknown, field: string): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`Invalid ${field}: expected 0x-prefixed hex string.`)
  }
  return value as Hex
}

function parseBase64UrlField(value: unknown, field: string): Hex {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing ${field}.`)
  }
  return bytesToHex(base64UrlToBytes(value.trim())) as Hex
}

function parseClientDataJson(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return JSON.stringify(value)
  throw new Error('Missing clientDataJSON.')
}

export function generateKeysCoinbasePasteSnippet(hash: Hex): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error('Expected a 32-byte hash hex string.')
  }
  return [
    `const challengeHex = '${hash.toLowerCase()}';`,
    'const hexToBytes = (hex) => {',
    "  const clean = hex.replace(/^0x/, '');",
    '  if (clean.length % 2 !== 0) throw new Error("odd hex length");',
    '  const out = new Uint8Array(clean.length / 2);',
    '  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);',
    '  return out;',
    '};',
    'const toBase64Url = (bytes) => {',
    "  let str = '';",
    '  for (const b of bytes) str += String.fromCharCode(b);',
    "  return btoa(str).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');",
    '};',
    'const challengeBytes = hexToBytes(challengeHex);',
    'const credential = await navigator.credentials.get({',
    '  publicKey: {',
    '    challenge: challengeBytes,',
    '    userVerification: "required",',
    '    timeout: 60000,',
    '    allowCredentials: [],',
    '  },',
    '});',
    "if (!credential) throw new Error('No credential returned.');",
    'const assertion = credential.response;',
    'const payload = {',
    "  source: 'keys.coinbase.com-passkey-paste-v1',",
    '  challengeHex,',
    '  credentialIdBase64Url: toBase64Url(new Uint8Array(credential.rawId)),',
    '  authenticatorDataBase64Url: toBase64Url(new Uint8Array(assertion.authenticatorData)),',
    '  signatureDerBase64Url: toBase64Url(new Uint8Array(assertion.signature)),',
    "  clientDataJSON: new TextDecoder().decode(new Uint8Array(assertion.clientDataJSON)),",
    "  origin: (() => { try { return JSON.parse(new TextDecoder().decode(new Uint8Array(assertion.clientDataJSON))).origin ?? null } catch { return null } })(),",
    '};',
    "console.log('keys.coinbase.com response JSON:');",
    'console.log(JSON.stringify(payload, null, 2));',
    'payload;',
  ].join('\n')
}

export function parseKeysCoinbasePasteResponse(text: string): KeysCoinbasePasteResponse {
  const block = readClipboardJsonBlock(text)
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(block) as Record<string, unknown>
  } catch (error) {
    try {
      payload = JSON.parse(tryNormalizeJsObjectLiteralToJson(block)) as Record<string, unknown>
    } catch {
      throw new Error(
        error instanceof Error
          ? `Could not parse pasted JSON: ${error.message}. Copy the JSON.stringify(payload, null, 2) output from the keys snippet.`
          : 'Could not parse pasted JSON. Copy the JSON.stringify(payload, null, 2) output from the keys snippet.',
      )
    }
  }

  const challengeHex =
    typeof payload.challengeHex === 'string' && payload.challengeHex.startsWith('0x')
      ? parseHex(payload.challengeHex, 'challengeHex')
      : parseBase64UrlField(payload.challengeBase64Url, 'challengeBase64Url')
  const authenticatorDataHex =
    typeof payload.authenticatorDataHex === 'string' && payload.authenticatorDataHex.startsWith('0x')
      ? parseHex(payload.authenticatorDataHex, 'authenticatorDataHex')
      : parseBase64UrlField(payload.authenticatorDataBase64Url, 'authenticatorDataBase64Url')
  const signatureDerHex =
    typeof payload.signatureDerHex === 'string' && payload.signatureDerHex.startsWith('0x')
      ? parseHex(payload.signatureDerHex, 'signatureDerHex')
      : parseBase64UrlField(payload.signatureDerBase64Url, 'signatureDerBase64Url')
  const credentialIdHex =
    typeof payload.credentialIdHex === 'string' && payload.credentialIdHex.startsWith('0x')
      ? parseHex(payload.credentialIdHex, 'credentialIdHex')
      : typeof payload.credentialIdBase64Url === 'string'
        ? parseBase64UrlField(payload.credentialIdBase64Url, 'credentialIdBase64Url')
        : null

  return {
    challengeHex,
    authenticatorDataHex,
    signatureDerHex,
    clientDataJSON: parseClientDataJson(payload.clientDataJSON),
    credentialIdHex,
  }
}

export function parseDerEcdsaSignature(der: Uint8Array | Hex): { r: bigint; s: bigint } {
  const bytes = typeof der === 'string' ? hexToBytes(der) : der
  return parseDerEcdsaSignatureBytes(bytes)
}

export function verifyChallengeMatchesHash(
  response: KeysCoinbasePasteResponse,
  expectedHash: Hex,
): string | null {
  const normalizedExpected = expectedHash.toLowerCase()
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedExpected)) {
    return 'Expected hash must be a 32-byte hex string.'
  }
  if (response.challengeHex.toLowerCase() !== normalizedExpected) {
    return 'Pasted challenge hash does not match the prepared UserOp hash.'
  }
  try {
    const clientData = JSON.parse(response.clientDataJSON) as Record<string, unknown>
    const challengeField = clientData.challenge
    if (typeof challengeField !== 'string') {
      return 'clientDataJSON.challenge is missing.'
    }
    const challengeFromClientData = bytesToHex(base64UrlToBytes(challengeField)).toLowerCase()
    if (challengeFromClientData !== normalizedExpected) {
      return 'clientDataJSON.challenge does not match the prepared UserOp hash.'
    }
  } catch (error) {
    return error instanceof Error
      ? `clientDataJSON parse failed: ${error.message}`
      : 'clientDataJSON parse failed.'
  }
  return null
}

export function buildWebAuthnSignatureWrapper(
  response: KeysCoinbasePasteResponse,
  ownerIndex = 0,
): Hex {
  if (!Number.isInteger(ownerIndex) || ownerIndex < 0) {
    throw new Error('ownerIndex must be a non-negative integer.')
  }

  const { r, s } = parseDerEcdsaSignature(response.signatureDerHex)
  const signatureData = encodeWebAuthnAuthSignature({
    authenticatorData: hexToBytes(response.authenticatorDataHex),
    clientDataJSON: response.clientDataJSON,
    r,
    s,
  })
  return encodeAbiParameters(SIGNATURE_WRAPPER_ABI, [BigInt(ownerIndex), signatureData]) as Hex
}

export function encodeChallengeHexToBase64Url(challengeHex: Hex): string {
  return bytesToBase64Url(hexToBytes(challengeHex))
}
