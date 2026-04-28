#!/usr/bin/env python3
"""Apply the AmoePlonkVerifier divergences to a raw snarkjs-emitted verifier.

The stock snarkjs PLONK verifier:
  - is named `PlonkVerifier` (we want `AmoePlonkVerifier`)
  - uses `pragma solidity >=0.7.0 <0.9.0` (we want `^0.8.20`)
  - has no header banner documenting circuit/SRS provenance
  - **DOES NOT** run `checkField` on `_pubSignals[0..7]`

That last omission is a real security bug for our use case: the on-chain
router tracks replay nullifiers by raw `uint256` value (usedNonceCommit,
usedWalletCommit, usedPointsBurnNullifier), and the PLONK verifier's
`addmod(.., q)` ops fold non-canonical encodings (x + k*q) back into the
field — so a malicious prover can submit two distinct raw uint256 values
that are field-equivalent and bypass each replay map.

This script reads the raw snarkjs file, applies all four divergences in
exact form, and writes the patched contract. The `EXPECTED_*` constants
below are also re-used by `tools/ci/check_amoe_plonk_patch.sh` so a CI
job can fail loudly if a future regen ever drops the patch.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys


# ----------------------------------------------------------------------------- 
# Patch fragments.
# ----------------------------------------------------------------------------- 

BANNER = """// SPDX-License-Identifier: GPL-3.0
// ┌──────────────────────────────────────────────────────────┐
// │  AmoePlonkVerifier — production-candidate                │
// │                                                          │
// │  Emitted by snarkjs 0.7.6 from amoe_plonk_final.zkey,    │
// │  which was produced by `snarkjs plonk setup` against:    │
// │    * R1CS:  amoe_eligibility.circom @ pragma 2.1.6,      │
// │             compiled with circom 2.1.9 -O1               │
// │    * SRS:   Hermez powersOfTau28_hez_final_17.ptau       │
// │             (universal, 174-contributor public ceremony  │
// │             run by 0kims/iden3 — no project-specific     │
// │             ceremony required)                           │
// │                                                          │
// │  Public-input layout (uint[8] _pubSignals) matches       │
// │  IAmoePlonkVerifier and the v2 Groth16 layout exactly:   │
// │    [0] walletAddrCommit                                  │
// │    [1] creatorCoinAddr                                   │
// │    [2] nonceCommit                                       │
// │    [3] epoch                                             │
// │    [4] allowlistRoot                                     │
// │    [5] pointsBurnedAsUSD                                 │
// │    [6] pointsLedgerRoot                                  │
// │    [7] pointsBurnNullifier                               │
// │                                                          │
// │  DIVERGENCE FROM STOCK SNARKJS OUTPUT:                   │
// │  Stock snarkjs PLONK verifiers `checkField` only the 24  │
// │  proof scalars and skip the 8 public inputs. We add an   │
// │  explicit `checkField` loop over `_pubSignals` right     │
// │  after `checkProofData()` so non-canonical encodings     │
// │  (x + k*q) cannot be used to bypass the router's raw-    │
// │  bytes replay maps. See the regression tests in          │
// │  test/zk/AmoePlonkVerifier.t.sol.                        │
// └──────────────────────────────────────────────────────────┘
//

"""

# The injected security check. Inserted immediately after `checkProofData()`
# in the body of `verifyProof`'s assembly block.
PUBLIC_INPUT_FIELD_GUARD = """
            // SECURITY: enforce that every public input is canonical (< q).
            // The default snarkjs PLONK verifier only `checkField`-validates
            // the 24 proof scalars; the 8 public inputs flow straight into
            // calculateChallenges/calculatePI as raw uint256 values. Without
            // this loop a prover could submit non-canonical encodings
            // (x + k*q) that are field-equivalent to a canonical value but
            // hash to different raw bytes, defeating the router's
            // raw-bytes replay maps (usedNonceCommit, usedWalletCommit,
            // usedPointsBurnNullifier). Reject any signal >= q before it
            // is used in the transcript.
            //
            // _pubSignals here resolves to the calldata offset of input[0]
            // (the same value the snarkjs-emitted code below passes as
            // `pPublic` / `pPub` into calculateChallenges / calculatePI).
            // 8 public inputs, each 32 bytes.
            checkField(calldataload(add(_pubSignals,   0)))
            checkField(calldataload(add(_pubSignals,  32)))
            checkField(calldataload(add(_pubSignals,  64)))
            checkField(calldataload(add(_pubSignals,  96)))
            checkField(calldataload(add(_pubSignals, 128)))
            checkField(calldataload(add(_pubSignals, 160)))
            checkField(calldataload(add(_pubSignals, 192)))
            checkField(calldataload(add(_pubSignals, 224)))

"""

# Regexes describing the snarkjs output. They are intentionally loose enough
# to survive minor version drift, but tight enough to reject anything that
# isn't recognizably the AMOE PLONK verifier shape.
RE_SPDX = re.compile(r"^// SPDX-License-Identifier: GPL-3\.0\s*\n", re.MULTILINE)
RE_PRAGMA = re.compile(r"pragma solidity\s+>=0\.7\.0\s*<0\.9\.0;")
RE_CONTRACT_NAME = re.compile(r"\bcontract\s+PlonkVerifier\b")
RE_CHECK_PROOF_DATA_CALL = re.compile(
    r"^(?P<indent>\s*)checkProofData\(\)\s*\n",
    re.MULTILINE,
)
RE_VERIFY_FN = re.compile(
    r"function\s+verifyProof\s*\(\s*uint256\[24\]\s+calldata\s+_proof\s*,\s*"
    r"uint256\[8\]\s+calldata\s+_pubSignals\s*\)"
)


def patch(raw: str) -> str:
    """Apply all four divergences. Raises if any expected anchor is missing."""

    # 1. Sanity: must be the AMOE-shaped PLONK verifier (24 proof + 8 pub).
    if not RE_VERIFY_FN.search(raw):
        raise SystemExit(
            "ERROR: input does not look like an AMOE-shaped PLONK verifier "
            "(expected `verifyProof(uint256[24] calldata, uint256[8] calldata)`)"
        )

    # 2. Strip the original SPDX line so we can replace the entire header
    #    block with our banner. snarkjs emits SPDX as the very first line.
    if not RE_SPDX.match(raw):
        raise SystemExit("ERROR: missing leading SPDX line in raw snarkjs output")
    body = RE_SPDX.sub("", raw, count=1)

    # 3. Bump pragma.
    if not RE_PRAGMA.search(body):
        raise SystemExit(
            "ERROR: could not find expected pragma `>=0.7.0 <0.9.0`. "
            "Has snarkjs changed its output? Inspect the raw file."
        )
    body = RE_PRAGMA.sub("pragma solidity ^0.8.20;", body, count=1)

    # 4. Rename the contract.
    if not RE_CONTRACT_NAME.search(body):
        raise SystemExit("ERROR: could not find `contract PlonkVerifier` to rename")
    body = RE_CONTRACT_NAME.sub("contract AmoePlonkVerifier", body, count=1)

    # 5. Inject the public-input field guard right after `checkProofData()`.
    #    Verify exactly one match — multiple matches would mean snarkjs has
    #    changed the verifier shape and the patch placement may be wrong.
    matches = RE_CHECK_PROOF_DATA_CALL.findall(body)
    if len(matches) != 1:
        raise SystemExit(
            f"ERROR: expected exactly one `checkProofData()` call site, "
            f"found {len(matches)}. Refusing to patch ambiguously."
        )
    body = RE_CHECK_PROOF_DATA_CALL.sub(
        lambda m: m.group(0) + PUBLIC_INPUT_FIELD_GUARD,
        body,
        count=1,
    )

    return BANNER + body


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--raw", required=True, type=pathlib.Path,
                   help="path to AmoePlonkVerifier_raw.sol from snarkjs")
    p.add_argument("--out", required=True, type=pathlib.Path,
                   help="path to write the patched verifier")
    args = p.parse_args()

    if not args.raw.is_file():
        print(f"ERROR: --raw not found: {args.raw}", file=sys.stderr)
        return 1

    raw = args.raw.read_text()
    patched = patch(raw)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(patched)
    print(f"wrote {args.out} ({len(patched.splitlines())} lines)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
