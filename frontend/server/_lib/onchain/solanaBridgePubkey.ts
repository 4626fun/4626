import type { Hex } from 'viem'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_MAP = new Map(BASE58_ALPHABET.split('').map((ch, idx) => [ch, idx]))

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  let num = 0n
  for (const byte of bytes) num = num * 256n + BigInt(byte)
  let encoded = ''
  while (num > 0n) {
    const remainder = Number(num % 58n)
    num /= 58n
    encoded = BASE58_ALPHABET[remainder] + encoded
  }
  for (const byte of bytes) {
    if (byte === 0) encoded = `1${encoded}`
    else break
  }
  return encoded
}

export function bytes32HexToSolanaPubkey(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const normalized = raw.toLowerCase()
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) return null
  if (normalized === `0x${'0'.repeat(64)}`) return null
  try {
    const bytes = Uint8Array.from(Buffer.from(normalized.slice(2), 'hex'))
    if (bytes.length !== 32) return null
    return encodeBase58(bytes)
  } catch {
    return null
  }
}

export function decodeBase58(value: string): Uint8Array {
  if (!value || typeof value !== 'string') throw new Error('Invalid base58 input')
  let num = 0n
  for (const ch of value.trim()) {
    const idx = BASE58_MAP.get(ch)
    if (idx === undefined) throw new Error(`Invalid base58 character: ${ch}`)
    num = num * 58n + BigInt(idx)
  }
  let hex = num.toString(16)
  if (hex.length % 2) hex = `0${hex}`
  let bytes = hex ? Uint8Array.from(Buffer.from(hex, 'hex')) : new Uint8Array()
  let leadingZeroes = 0
  for (const ch of value) {
    if (ch === '1') leadingZeroes += 1
    else break
  }
  if (leadingZeroes > 0) {
    const prefixed = new Uint8Array(leadingZeroes + bytes.length)
    prefixed.set(bytes, leadingZeroes)
    bytes = prefixed
  }
  return bytes
}

export function solanaPubkeyToBytes32Hex(pubkey: string): Hex {
  const decoded = decodeBase58(pubkey)
  if (decoded.length !== 32) {
    throw new Error(`Expected 32-byte Solana pubkey, got ${decoded.length} bytes`)
  }
  return `0x${Buffer.from(decoded).toString('hex')}` as Hex
}

export function parseMintPubkeyFromWrapOutput(text: string): string | null {
  const match = text.match(/Mint:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i)
  return match?.[1] ?? null
}

export function parseMintPubkeyFromAlreadyExistsError(text: string): string | null {
  const match = text.match(/Address\s*\{\s*address:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i)
  return match?.[1] ?? null
}
