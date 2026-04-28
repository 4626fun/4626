# Contributor Instructions — AMOE v2 Phase-2 Ceremony

> Hi. You agreed to be a contributor in the AMOE v2 trusted setup. This
> document is the entire procedure. If anything here is unclear, **stop and
> ask the coordinator** — there is no time pressure on individual
> contributions, but a confused contributor is worse than a slow one.

The whole thing takes ~10 minutes of your time and produces one file you
ship back to the coordinator.

---

## 0. What you are doing

You will receive one file (~7 MB), run a single snarkjs command on your
machine (which mixes your fresh randomness into it), get a different file
back out, and ship that file to the coordinator. **The randomness used
must be destroyed afterwards** — that is what makes the ceremony secure.

The cryptographic guarantee is: **as long as at least ONE contributor in
the chain was honest and destroyed their randomness, no one — not the
project team, not a future attacker — can forge a Groth16 proof against
this circuit.**

So: be the honest one. That's the entire job.

---

## 1. What you need

- A machine you trust (your own laptop is fine — does not need to be
  air-gapped, but ideally is one you reboot after).
- Node.js ≥ 18 with `snarkjs` and `circom` v2.
- ~10 minutes.
- A way to receive and send a ~7 MB file (Signal, Dropbox, AirDrop, S3,
  whatever).

Install snarkjs if you don't have it:

```bash
npm install -g snarkjs
```

Check version (should be `0.7.x` or higher):

```bash
snarkjs --version
```

---

## 2. Receive your input file

The coordinator will send you a file named `amoe_v2_<NNNN>.zkey` where
`<NNNN>` is your position in the chain (e.g. `amoe_v2_0001.zkey` if you
are contributor 2 — they receive 0000 from the coordinator's setup step).

Save it somewhere local, e.g. `~/amoe-ceremony/`.

You should also receive:

- A pointer to the **manifest** (`circuits/amoe/ceremony/v2/v2-manifest.md`
  in this repo at a tagged commit).
- The expected **circuit hash** the coordinator already verified.

---

## 3. (Optional but recommended) Verify what you received

This step is optional — you can skip it and trust the coordinator. But if
you want defense-in-depth:

```bash
# Clone the repo at the tagged commit named in the manifest
git clone https://github.com/wenakita/4626.git
cd 4626
git checkout amoe-v2-ceremony-start

# Re-derive the circuit hash from source
cd circuits/amoe/build
snarkjs groth16 setup amoe_eligibility.r1cs pot14_final.ptau /tmp/probe.zkey \
    2>&1 | grep -A4 "Circuit hash"

# Compare against the hash printed in v2-manifest.md §1.
# If they don't match — STOP and tell the coordinator.
```

---

## 4. Make your contribution

This is the main step. From the directory where you saved your input zkey:

```bash
# Replace 0001 with your actual position number from the file you received.
INPUT="amoe_v2_0001.zkey"
OUTPUT="amoe_v2_0002.zkey"   # increment by 1
NAME="<your handle> <today's date>"   # e.g. "alice@example.com 2026-05-04"

snarkjs zkey contribute "$INPUT" "$OUTPUT" \
    --name="$NAME" \
    -e="$(head -c 64 /dev/urandom | xxd -p -c 64)"
```

**What that command does:**
- Reads the proving key from `$INPUT`.
- Mixes 512 bits of fresh kernel randomness into it.
- Writes the new proving key to `$OUTPUT`.
- Embeds your `--name` and the resulting contribution hash into the file.

The command will print something like:

```
Contribution Hash:
    a1b2c3d4 e5f60718 29304a4b 5c6d7e8f
    9081a2b3 c4d5e6f7 0817293a 4b5c6d7e
    ...
```

**Save that hash somewhere you can post it publicly.** Step 6 covers what
to do with it.

---

## 5. Destroy your entropy

The contribution mixed `/dev/urandom` output into the zkey. That data is
the "toxic waste" — if anyone ever reconstructs it, they can forge proofs.

Minimum:

```bash
# Reboot the machine. /dev/urandom state is reset.
sudo reboot
```

Better (paranoid):

- If you ran the contribution from a live USB, discard the USB.
- If you ran on a VM, destroy the VM image.
- If you ran on a long-lived machine, at minimum reboot it; consider
  cycling any `/tmp` SSD that might still hold the entropy.

The randomness is gone the moment your shell process exits. Reboot just
ensures any swap/`/tmp` is wiped.

---

## 6. Ship the output and post the hash

Send `$OUTPUT` (e.g. `amoe_v2_0002.zkey`) back to the coordinator via the
same channel you received the input.

**Publicly post your contribution hash.** Standard channels:

- Reply on the GitHub issue tracking the ceremony with the hash + your
  handle + the date.
- Optional: PGP-sign the hash and include the signature.
- Optional: post to your X / Mastodon / personal blog.

Posting publicly lets future auditors confirm the same hash you saw on
your machine is the one embedded in the final zkey.

Example post:

> AMOE v2 ceremony contribution #2 — alice@example.com — 2026-05-04
>
> ```
> a1b2c3d4 e5f60718 29304a4b 5c6d7e8f
> 9081a2b3 c4d5e6f7 0817293a 4b5c6d7e
> ...
> ```
>
> Verified against manifest at commit `<sha>`, R1CS hash
> `b93497b0 68d1b96b fec84a90 be154a55 ...`.

---

## 7. (Optional) Verify the final ceremony when it's done

When the coordinator publishes `amoe_v2_final.zkey`, you can verify your
contribution made it in:

```bash
snarkjs zkey verify amoe_eligibility.r1cs pot14_final.ptau amoe_v2_final.zkey
```

This walks the entire chain and prints every contribution hash. Yours
should be in there exactly as you saw it on your machine.

---

## FAQ

**Q: What if my machine crashes mid-contribution?**
Just restart from the input zkey. Each `zkey contribute` call mixes its
own fresh randomness — there's no "resume" semantic. The previous attempt
is harmless because nothing was shipped.

**Q: What if I notice the input zkey hash doesn't match what the
coordinator told me?**
Stop. Don't contribute. Tell the coordinator on a different channel
(Signal voice, in-person, etc.). This could just be a typo, but it could
also be a man-in-the-middle.

**Q: Can I verify my randomness was actually used?**
Sort of. snarkjs derives a contribution hash from `(input_zkey,
your_entropy)` deterministically, so if you ran the command twice with
different entropy you'd get different hashes — and that hash is what gets
embedded. So yes, your entropy provably influenced the output.

**Q: I'm worried I might be coerced. Is there a way to deniably contribute?**
Yes — multiple people can be the same logical "contributor" by running
the contribution against different machines and only one of them shipping
the result. Talk to the coordinator if this matters to you.

**Q: Do I get paid?**
The coordinator should tell you. Default expectation: this is a
public-good contribution and you get acknowledged in the ceremony record
+ this repo.
