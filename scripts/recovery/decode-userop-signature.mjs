#!/usr/bin/env node
/**
 * decode-userop-signature.mjs
 *
 * Decode a Coinbase Smart Wallet userOp.signature blob into its structured
 * SignatureWrapper { ownerIndex, signatureData } fields. When ownerIndex
 * points at a passkey owner, signatureData is further decoded as
 * WebAuthnAuth { authenticatorData, clientDataJSON, challengeIndex,
 * typeIndex, r, s } and the base64url-encoded challenge is converted to
 * the 32-byte hex hash that the passkey actually signed (this is the
 * `getUserOpHashWithoutChainId(userOp)` value when the userOp wraps
 * `executeWithoutChainIdValidation`).
 *
 * Usage:
 *   node decode-userop-signature.mjs <signature_hex>
 *   node decode-userop-signature.mjs 0x000000…
 *   echo 0x000000… | node decode-userop-signature.mjs -
 *
 * When ownerIndex points at an ECDSA owner, signatureData is the 65-byte
 * (r || s || v) ECDSA signature; this script also recovers the signer
 * address (both EIP-191 prefixed and raw) so you can verify which key
 * actually signed.
 *
 * Background: see RECOVERY.md for the full playbook. This script was
 * written during the May 4 2026 recovery of CSW
 * 0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef and validated against the
 * confirmed-good signature from userOpHash
 * 0x70255628ea8816f84e6d0657cabfdca810d1024e0d147ce75c3c6174dc2c5b1a.
 */

import { decodeAbiParameters } from 'viem';
import { readFileSync } from 'node:fs';

function readArg() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node decode-userop-signature.mjs <signature_hex>\n       node decode-userop-signature.mjs -   (read hex from stdin)');
    process.exit(1);
  }
  if (arg === '-') {
    return readFileSync(0, 'utf8').trim();
  }
  return arg.trim();
}

function normalize(hex) {
  let s = hex.trim().replace(/\s+/g, '').replace(/^0x/i, '');
  if (s.length % 2 !== 0) {
    console.error(`Refusing to decode: hex length ${s.length} is odd.`);
    process.exit(1);
  }
  return ('0x' + s);
}

const sig = normalize(readArg());
console.log(`Total signature bytes: ${(sig.length - 2) / 2}\n`);

// ── Outer: SignatureWrapper ──────────────────────────────────────────────
let wrapper;
try {
  const outer = decodeAbiParameters(
    [{
      type: 'tuple',
      components: [
        { name: 'ownerIndex', type: 'uint256' },
        { name: 'signatureData', type: 'bytes' },
      ],
    }],
    sig,
  );
  wrapper = outer[0];
} catch (err) {
  console.error('Failed to decode SignatureWrapper:', err.message);
  console.error('Input may not be a Coinbase Smart Wallet signature blob.');
  process.exit(2);
}

console.log('=== SignatureWrapper ===');
console.log('  ownerIndex     :', wrapper.ownerIndex.toString());
console.log('  signatureData  :', `(${(wrapper.signatureData.length - 2) / 2} bytes)`);
console.log('  signatureData  :', wrapper.signatureData);
console.log();

// ── Inner: try WebAuthnAuth, fall back to raw ECDSA ──────────────────────
const innerLen = (wrapper.signatureData.length - 2) / 2;

if (innerLen === 65) {
  // Raw ECDSA — owner is an EOA address.
  console.log('=== ECDSA signature (65 bytes — owner is an EOA) ===');
  const r = '0x' + wrapper.signatureData.slice(2, 66);
  const s = '0x' + wrapper.signatureData.slice(66, 130);
  const v = '0x' + wrapper.signatureData.slice(130, 132);
  console.log('  r:', r);
  console.log('  s:', s);
  console.log('  v:', v, '(decimal:', parseInt(v, 16) + ')');
  console.log();
  console.log('To recover the signer, you need the message hash that was signed.');
  console.log('For a CSW userOp, that is `getUserOpHashWithoutChainId(userOp)`.');
  console.log('Pass the message hash to ecrecover off-line.');
  process.exit(0);
}

// Otherwise assume WebAuthnAuth.
let webauthn;
try {
  const inner = decodeAbiParameters(
    [{
      type: 'tuple',
      components: [
        { name: 'authenticatorData', type: 'bytes' },
        { name: 'clientDataJSON', type: 'string' },
        { name: 'challengeIndex', type: 'uint256' },
        { name: 'typeIndex', type: 'uint256' },
        { name: 'r', type: 'uint256' },
        { name: 's', type: 'uint256' },
      ],
    }],
    wrapper.signatureData,
  );
  webauthn = inner[0];
} catch (err) {
  console.error('Failed to decode WebAuthnAuth:', err.message);
  console.error('signatureData may use a non-standard shape.');
  process.exit(3);
}

console.log('=== WebAuthnAuth ===');
const authData = webauthn.authenticatorData;
const authBytes = (authData.length - 2) / 2;
console.log('  authenticatorData :', authData);
console.log('    length          :', authBytes, 'bytes');
if (authBytes >= 37) {
  const rpIdHash = '0x' + authData.slice(2, 66);
  const flagsByte = parseInt(authData.slice(66, 68), 16);
  const signCount = '0x' + authData.slice(68, 76);
  const flagBits = flagsByte.toString(2).padStart(8, '0');
  const flagDecode = [
    flagsByte & 0x01 ? 'UP' : '·',
    flagsByte & 0x04 ? 'UV' : '·',
    flagsByte & 0x40 ? 'AT' : '·',
    flagsByte & 0x80 ? 'ED' : '·',
  ].join(' ');
  console.log('    rpIdHash        :', rpIdHash);
  console.log(`    flags byte      : 0x${flagsByte.toString(16).padStart(2, '0')} = 0b${flagBits}  [${flagDecode}]`);
  console.log('    signCount       :', signCount);
}
console.log('  clientDataJSON    :', webauthn.clientDataJSON);
console.log('  challengeIndex    :', webauthn.challengeIndex.toString());
console.log('  typeIndex         :', webauthn.typeIndex.toString());
console.log('  r                 : 0x' + webauthn.r.toString(16).padStart(64, '0'));
console.log('  s                 : 0x' + webauthn.s.toString(16).padStart(64, '0'));
console.log();

// ── Verification ─────────────────────────────────────────────────────────
console.log('=== Verification ===');
let cdj;
try {
  cdj = JSON.parse(webauthn.clientDataJSON);
} catch (err) {
  console.error('  clientDataJSON does not parse as JSON:', err.message);
  process.exit(4);
}
console.log('  type              :', cdj.type, cdj.type === 'webauthn.get' ? '✅' : '❌ (expected "webauthn.get")');
console.log('  challenge (b64u)  :', cdj.challenge);
console.log('  origin            :', cdj.origin);
if (cdj.androidPackageName) {
  console.log('  androidPackage    :', cdj.androidPackageName);
}
if (cdj.crossOrigin !== undefined) {
  console.log('  crossOrigin       :', cdj.crossOrigin);
}

// Decode challenge from base64url to hex.
const b64url = String(cdj.challenge ?? '').replace(/-/g, '+').replace(/_/g, '/');
const padded = b64url + '='.repeat((4 - (b64url.length % 4)) % 4);
let challengeBytes;
try {
  challengeBytes = Buffer.from(padded, 'base64');
} catch (err) {
  console.error('  challenge does not decode as base64url:', err.message);
  process.exit(5);
}
console.log('  challenge (hex)   : 0x' + challengeBytes.toString('hex'));
console.log('  challenge length  :', challengeBytes.length, 'bytes', challengeBytes.length === 32 ? '✅' : '❌ (expected 32)');

// Index sanity checks.
const cdjStr = webauthn.clientDataJSON;
const ti = Number(webauthn.typeIndex);
const ci = Number(webauthn.challengeIndex);
const typeSlice = cdjStr.slice(ti, ti + 18);
const chalSlice = cdjStr.slice(ci, ci + 60);
console.log();
console.log('  Index sanity:');
console.log(`    cdj[typeIndex=${ti}, +18]      : ${JSON.stringify(typeSlice)} ${typeSlice.startsWith('"type"') ? '✅' : '❌'}`);
console.log(`    cdj[challengeIndex=${ci}, +60] : ${JSON.stringify(chalSlice)} ${chalSlice.startsWith('"challenge"') ? '✅' : '❌'}`);

// r/s sanity.
const rZero = webauthn.r === 0n;
const sZero = webauthn.s === 0n;
console.log();
console.log('  r/s sanity:');
console.log('    r != 0           :', rZero ? '❌' : '✅');
console.log('    s != 0           :', sZero ? '❌' : '✅');

console.log();
console.log('Done. The 32-byte challenge above is the message hash the passkey signed.');
console.log('For CSW userOps that wrap executeWithoutChainIdValidation, this is');
console.log('  getUserOpHashWithoutChainId(userOp).');
console.log('For ordinary userOps, it is');
console.log('  EntryPoint.getUserOpHash(userOp).');
