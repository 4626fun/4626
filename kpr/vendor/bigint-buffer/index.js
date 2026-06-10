'use strict'

// Pure JS implementation of bigint-buffer (no native bindings).
// Forked to avoid CVE-2025-3194 in the upstream native addon.

/**
 * Convert a little-endian buffer into a BigInt.
 * @param {Buffer} buf
 * @returns {bigint}
 */
function toBigIntLE(buf) {
  const reversed = Buffer.from(buf)
  reversed.reverse()
  const hex = reversed.toString('hex')
  if (hex.length === 0) return BigInt(0)
  return BigInt(`0x${hex}`)
}

/**
 * Convert a big-endian buffer into a BigInt.
 * @param {Buffer} buf
 * @returns {bigint}
 */
function toBigIntBE(buf) {
  const hex = buf.toString('hex')
  if (hex.length === 0) return BigInt(0)
  return BigInt(`0x${hex}`)
}

/**
 * Convert a BigInt to a little-endian buffer.
 * @param {bigint} num
 * @param {number} width
 * @returns {Buffer}
 */
function normalizeWidth(width) {
  if (!Number.isInteger(width) || width < 0) {
    throw new RangeError('width must be a non-negative integer')
  }
  return width
}

function normalizeHex(num) {
  if (typeof num !== 'bigint') {
    throw new TypeError('num must be a bigint')
  }
  if (num < BigInt(0)) {
    throw new RangeError('num must be >= 0')
  }
  const rawHex = num.toString(16)
  return rawHex.length % 2 === 0 ? rawHex : `0${rawHex}`
}

function toSizedHex(num, width) {
  const bytes = normalizeWidth(width)
  if (bytes === 0) return ''
  const hex = normalizeHex(num)
  const targetLength = bytes * 2
  if (hex.length > targetLength) {
    // Keep least-significant bytes when constraining width.
    return hex.slice(hex.length - targetLength)
  }
  return hex.padStart(targetLength, '0')
}

function toBufferLE(num, width) {
  const hex = toSizedHex(num, width)
  const buffer = Buffer.from(hex, 'hex')
  buffer.reverse()
  return buffer
}

/**
 * Convert a BigInt to a big-endian buffer.
 * @param {bigint} num
 * @param {number} width
 * @returns {Buffer}
 */
function toBufferBE(num, width) {
  const hex = toSizedHex(num, width)
  return Buffer.from(hex, 'hex')
}

module.exports = {
  toBigIntLE,
  toBigIntBE,
  toBufferLE,
  toBufferBE,
}

