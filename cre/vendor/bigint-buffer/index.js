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
function toBufferLE(num, width) {
  const hex = num.toString(16)
  const buffer = Buffer.from(hex.padStart(width * 2, '0').slice(0, width * 2), 'hex')
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
  const hex = num.toString(16)
  return Buffer.from(hex.padStart(width * 2, '0').slice(0, width * 2), 'hex')
}

module.exports = {
  toBigIntLE,
  toBigIntBE,
  toBufferLE,
  toBufferBE,
}

