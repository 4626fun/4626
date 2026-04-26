#!/usr/bin/env python3
"""Decompress a BLS12-381 G2 compressed point and emit EIP-2537 256-byte encoding.

Input: 96-byte hex string (drand quicknet group public key, compressed G2).
Output: 256-byte hex (EIP-2537 G2 encoding: Fp2 x = (x_c0 || x_c1), Fp2 y = (y_c0 || y_c1),
each Fp element = 64 bytes BE, padded from 48-byte field).

Note: Fp2 element = a + b*u, encoded as (a || b) per EIP-2537 (c0 first).

We use py_ecc to do the decompression. If unavailable, install: pip install py_ecc
"""
import sys

try:
    from py_ecc.bls12_381 import bls12_381_curve as curve
    from py_ecc.bls.point_compression import decompress_G2
    from py_ecc.optimized_bls12_381 import optimized_curve as oc
    from py_ecc.bls.constants import POW_2_381, POW_2_382, POW_2_383
except ImportError:
    print("Please: pip install py_ecc", file=sys.stderr)
    sys.exit(1)

PK_HEX = "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a"

assert len(PK_HEX) == 192, "G2 compressed must be 96 bytes (192 hex chars)"

pk_bytes = bytes.fromhex(PK_HEX)

# G2 compressed format (zcash spec, used by drand and IETF BLS):
#  - 96 bytes = z1 (48) || z2 (48)
#  - z1 high 3 bits = (C, I, S) flags: C=compressed, I=infinity, S=sign of y
#  - z1 mod 2^381 = x_c1  (the IMAGINARY part of Fp2 element x)
#  - z2 = x_c0  (the REAL part of Fp2 x)
# In Fp2 = a + b*u, the convention (zcash) is z1 = b (imaginary), z2 = a (real).
# EIP-2537 expects c0 first (real first): x_c0 || x_c1.

z1 = int.from_bytes(pk_bytes[:48], "big")
z2 = int.from_bytes(pk_bytes[48:], "big")

C = (z1 >> 383) & 1
I = (z1 >> 382) & 1
S = (z1 >> 381) & 1
print(f"flags: C={C} I={I} S={S}", file=sys.stderr)
assert C == 1, "must be compressed"
assert I == 0, "must not be infinity"

# Decompress using py_ecc
g2_point = decompress_G2((z1, z2))
x, y = g2_point[0], g2_point[1]   # affine coords; FQ2 each

# FQ2 in py_ecc has .coeffs = (c0, c1) where element = c0 + c1*u
xc0 = int(x.coeffs[0])
xc1 = int(x.coeffs[1])
yc0 = int(y.coeffs[0])
yc1 = int(y.coeffs[1])

def enc(v):
    """Encode an Fp element as 64-byte big-endian, zero-padded from 48."""
    return v.to_bytes(64, "big")

out = enc(xc0) + enc(xc1) + enc(yc0) + enc(yc1)
assert len(out) == 256
print(f"len: {len(out)}", file=sys.stderr)
# Print as Solidity hex strings, 32-byte chunks for readability:
hexs = out.hex()
print("// drand quicknet group public key (G2), EIP-2537 encoded (256 bytes)")
for i in range(0, len(hexs), 64):
    print(f'hex"{hexs[i:i+64]}"')
print()
print("Full hex:")
print(hexs)
