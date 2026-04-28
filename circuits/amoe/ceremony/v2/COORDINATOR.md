# Coordinator Runbook — AMOE v2 Phase-2 Ceremony

> This is the operator runbook for the **person running the ceremony**
> (you). Contributors get `INSTRUCTIONS.md`. Public observers get
> `v2-manifest.md`. You get this.

The whole flow is sequential: setup → contributor 1 → ... → contributor N
→ Bitcoin beacon → emit verifier → tag commit. Allow ~1 week for
contributor logistics + ~1 week of buffer for the chosen Bitcoin block to
mine.

---

## Pre-ceremony checklist

- [ ] Recruited ≥ 3 independent contributors. Their handles are filled in
      `v2-manifest.md` §3.
- [ ] Confirmed each contributor has a way to run `snarkjs` and receive a
      ~7 MB file.
- [ ] Picked a future Bitcoin block height (≥ 1 week out) and pinned it in
      `v2-manifest.md` §5.
- [ ] Picked a contact channel for the contribution-hash bulletin (a
      GitHub issue is the standard pick). Linked from §3 of the manifest.
- [ ] Tagged the manifest commit:
      ```bash
      git tag -s amoe-v2-ceremony-start -m "AMOE v2 ceremony manifest pinned"
      git push origin amoe-v2-ceremony-start
      ```
- [ ] Confirmed `circuits/amoe/build/pot14_final.ptau` matches the SHA-256
      pinned in the manifest §2.

---

## Step 0 — Coordinator setup

This produces `amoe_v2_0000.zkey`, the empty starting file every
contribution chains off of.

```bash
bash circuits/amoe/ceremony/v2/scripts/00-setup.sh
```

The script:

1. Confirms `pot14_final.ptau` is present and matches the manifest hash.
2. Confirms `amoe_eligibility.r1cs` matches the manifest's circuit hash.
3. Runs `snarkjs groth16 setup` → produces `amoe_v2_0000.zkey`.
4. Prints the SHA-256 of the produced zkey, which you'll send to
   contributor 1 alongside the file.

**Coordinator entropy choice:** step 0 itself does NOT use coordinator
entropy — it's deterministic from the (R1CS, ptau) pair. Coordinator
entropy enters the chain only if you choose to also be a contributor;
your CEREMONY.md spec recommends that even if you do, at least 2 of the
3+ contributors are NOT the coordinator.

---

## Step 1..N — Per-contribution receive

For each contributor, in order:

1. Send them `amoe_v2_<N-1>.zkey` + the manifest commit SHA + the
   expected R1CS hash.
2. Wait for them to ship back `amoe_v2_<N>.zkey`.
3. Run the verification script:
   ```bash
   bash circuits/amoe/ceremony/v2/scripts/01-verify-contribution.sh \
       circuits/amoe/build/amoe_v2_<N>.zkey
   ```
   This script:
   - Runs `snarkjs zkey verify` against the full chain so far.
   - Extracts the contribution hash and contributor name from the new
     zkey.
   - Appends a row to `ceremony_transcript_v2.txt`.
4. Cross-check the contribution hash against what the contributor posted
   publicly. **If they don't match, stop the ceremony** — something
   tampered with the file in transit.
5. Move on to the next contributor.

---

## Step F — Final beacon

Wait for the Bitcoin block height pinned in the manifest §5 to be mined.

Get its hash from any Bitcoin explorer (e.g.
`https://mempool.space/block/<hash>`). Cross-reference at least 2 sources
to be sure.

Then:

```bash
bash circuits/amoe/ceremony/v2/scripts/02-finalize.sh \
    <bitcoin_block_hash_hex> \
    <bitcoin_block_height>
```

The script:

1. Confirms the latest contribution chain still verifies.
2. Runs `snarkjs zkey beacon <last>.zkey amoe_v2_final.zkey <hash> 10`.
3. Re-runs `zkey verify` against `amoe_v2_final.zkey` (full chain
   including beacon).
4. Emits `verification_key_v2.json` and `AmoeGroth16Verifier_v2.sol`.
5. Appends the final beacon row to `ceremony_transcript_v2.txt`.
6. Prints a final summary with the SHA-256 of every output artifact.

---

## Step P — Publish and tag

After step F:

- [ ] Commit the final ceremony artifacts:
      - `circuits/amoe/build/amoe_v2_final.zkey` — large, may want git-lfs
        or a release attachment instead.
      - `circuits/amoe/build/verification_key_v2.json` — small, commit.
      - `circuits/amoe/build/AmoeGroth16Verifier_v2.sol` — commit.
      - `circuits/amoe/ceremony/v2/ceremony_transcript_v2.txt` — commit.
- [ ] Update `circuits/amoe/CEREMONY.md` §"v2 contributor table" with the
      now-known operators, dates, hardware, and contribution hashes.
- [ ] Tag:
      ```bash
      git tag -s amoe-v2-ceremony-final -m "AMOE v2 ceremony complete"
      git push origin amoe-v2-ceremony-final
      ```
- [ ] Open a follow-up PR replacing `MockAmoeGroth16Verifier_v2`
      references with the real `AmoeGroth16Verifier_v2.sol`. (See issue
      #403 §1.)

---

## Failure modes & responses

| Symptom | Likely cause | Action |
|---------|-------------|--------|
| Contributor's posted hash ≠ hash in returned zkey | File modified in transit, OR contributor ran the wrong command | Discard that contribution. Restart from contributor's input. |
| `zkey verify` fails after a contribution | Contributor used the wrong input zkey OR pot14 mismatch | Discard. Re-issue the input file with confirmed hash. |
| R1CS hash drift between manifest and current source | Someone touched the circuit after manifest was tagged | Stop. Either revert the circuit drift or re-tag a new manifest. |
| Contributor goes silent for days | Personal scheduling | OK to skip them; security only requires ≥1 honest, more is better. Update §3 of the manifest if you do. |
| Bitcoin block reorgs after you ran the beacon | < 6-confirmation rebroadcast | Wait for 100+ confirmations on the chosen block before running the beacon. Re-run if an actual reorg occurs (extremely rare at chosen depth). |

---

## Time budget

| Stage | Wall-clock |
|-------|-----------|
| Recruit contributors | 1-3 weeks (gating step) |
| Tag manifest | 1 day |
| Step 0 (setup) | < 1 minute compute |
| Each contribution | < 10 min compute + ship/receive logistics |
| Wait for Bitcoin beacon block | 1-2 weeks (whatever height was pinned) |
| Step F (beacon) | < 5 min compute |
| Verify, commit, tag, follow-up PR | 1 day |

Net: ~3-4 weeks if you start from "no contributors lined up." Most of
that is recruiting and waiting for the beacon block; only ~1 hour is
actual command-running.
