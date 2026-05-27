[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeWitness

# server/\_lib/lottery/amoeWitness

## Interfaces

### AmoeWitnessRawInputs

Defined in: [server/\_lib/lottery/amoeWitness.ts:265](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L265)

Raw, application-level inputs the API handler receives. Each value is
a `bigint` — callers are responsible for parsing whatever wire format
they got (decimal string from JSON, hex from the wallet, etc.) into a
canonical `bigint` before invoking `assembleAmoeWitness`.

Why bigints and not strings?
  * The circuit consumes field elements (`bigint` semantics).
  * Forcing the caller to parse explicitly avoids silent base-mismatches
    (e.g. a hex string parsed as decimal). The handler that converts
    wire → bigint is the right place to surface a parse error.

#### Properties

##### creatorCoinAddr

> **creatorCoinAddr**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:281](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L281)

Creator coin contract address as a 160-bit bigint.

##### epoch

> **epoch**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:283](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L283)

Daily epoch counter, ≤ 2^64 - 1.

##### nonce

> **nonce**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:274](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L274)

Server-issued bytes32 nonce. Domain: `[0, 2^256)`. Will be reduced
mod the BN254 scalar field modulus (`Q`) by the assembler before
being hashed into `nonceCommit`. ~81% of `randomBytes(32)` outputs
are above `Q` — see `lotteryAmoe.ts::issueAmoeNonce` for the issuer.

##### pointsBurnedAsUSD

> **pointsBurnedAsUSD**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:299](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L299)

Points burned, expressed in USD-cents (i.e. `points * 10_000`). Must
fit in 64 bits per the circuit. Business-rule bands (100..1M points)
are enforced by the Solidity layer.

##### signupIdHash

> **signupIdHash**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:288](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L288)

Hash of the user's signup ID (off-chain). Bytes32 domain;
canonicalized mod Q before hashing.

##### spendRefIdHash

> **spendRefIdHash**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:293](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L293)

Hash of the points-burn spend reference. Bytes32 domain; canonicalized
mod Q before hashing.

##### twitterCreditNullifier

> **twitterCreditNullifier**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:279](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L279)

Nullifier derived from the user's Twitter credential. Bytes32 domain;
canonicalized mod Q before hashing.

##### wallet

> **wallet**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:267](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L267)

EVM wallet address as a 160-bit bigint (e.g. `BigInt('0x...')`).

***

### AmoeWitnessTreeContext

Defined in: [server/\_lib/lottery/amoeWitness.ts:308](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L308)

Tree context the witness assembler needs — typically supplied by the
daily snapshot publisher. Two trees because the circuit verifies
inclusion in *both*: the wallet's allowlist membership, and the burn
row's presence in the day's points-burn ledger.

#### Properties

##### allowlistLeafIndex

> **allowlistLeafIndex**: `number`

Defined in: [server/\_lib/lottery/amoeWitness.ts:315](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L315)

Index of *this* wallet's leaf in the allowlist snapshot.

##### allowlistSnapshot

> **allowlistSnapshot**: [`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

Defined in: [server/\_lib/lottery/amoeWitness.ts:313](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L313)

The allowlist snapshot for `epoch`. Leaves are
`Poseidon2(wallet, epoch)` for every wallet allowlisted in this epoch.

##### pointsLedgerLeafIndex

> **pointsLedgerLeafIndex**: `number`

Defined in: [server/\_lib/lottery/amoeWitness.ts:323](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L323)

Index of *this* burn row's leaf in the ledger snapshot.

##### pointsLedgerSnapshot

> **pointsLedgerSnapshot**: [`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

Defined in: [server/\_lib/lottery/amoeWitness.ts:321](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L321)

The points-burn ledger snapshot for `epoch`. Leaves are
`Poseidon5(signupIdHash, spendRefIdHash, pointsBurnedAsUSD, epoch,
walletAddrCommit)`.

***

### AssembleAmoeWitnessArgs

Defined in: [server/\_lib/lottery/amoeWitness.ts:331](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L331)

Combined input for [assembleAmoeWitness](#assembleamoewitness). Splits cleanly between
"what the user supplied" and "what the daily snapshot publisher
supplied" so callers can compose the two streams independently.

#### Properties

##### raw

> **raw**: [`AmoeWitnessRawInputs`](#amoewitnessrawinputs)

Defined in: [server/\_lib/lottery/amoeWitness.ts:332](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L332)

##### trees

> **trees**: [`AmoeWitnessTreeContext`](#amoewitnesstreecontext)

Defined in: [server/\_lib/lottery/amoeWitness.ts:333](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L333)

## Variables

### AMOE\_BN254\_FIELD\_MODULUS

> `const` **AMOE\_BN254\_FIELD\_MODULUS**: `21888242871839275222246405745257275088548364400416034343698204186575808495617n` = `21888242871839275222246405745257275088548364400416034343698204186575808495617n`

Defined in: [server/\_lib/lottery/amoeWitness.ts:239](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L239)

BN254 scalar field modulus. Every signal in the circuit must lie in
`[0, Q)`. Inputs whose domain is naturally bounded by Q (EVM addresses,
uint64 counters, USD-cent amounts) are strict-checked; bytes32-domain
inputs (server-issued random nonces, off-chain identifier hashes) are
canonicalized via [canonicalizeAmoeBytes32ToField](#canonicalizeamoebytes32tofield) — see that
helper for the rationale.

***

### AMOE\_BYTES32\_DOMAIN\_MAX

> `const` **AMOE\_BYTES32\_DOMAIN\_MAX**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:247](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L247)

Maximum bytes32 value (2^256 - 1). Used as the domain bound for
`canonicalizeAmoeBytes32ToField`. Any input larger than this is a
caller bug — e.g. a 33-byte buffer parsed as a bigint, or a negative
bigint coerced via two's complement.

***

### AMOE\_EPOCH\_GENESIS\_SECONDS

> `const` **AMOE\_EPOCH\_GENESIS\_SECONDS**: `1777507200n`

Defined in: [server/\_lib/lottery/amoeWitness.ts:142](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L142)

Genesis timestamp for the AMOE epoch counter, in seconds since the Unix
epoch (UTC). The first epoch (E=0) starts at this instant; subsequent
epochs roll over every [AMOE\_EPOCH\_LENGTH\_SECONDS](#amoe_epoch_length_seconds) seconds.

**Pinned value:** `2026-04-30T00:00:00Z` = 1_777_507_200. This is the
first UTC midnight strictly after PR #426 (the witness module) merged
at 2026-04-29T06:10:43Z, satisfying the design constraint in
`docs/security/amoe-points-burn-ledger-sot.md` §10. Verified:
`Date.UTC(2026, 3, 30, 0, 0, 0) / 1000 === 1_777_507_200`.

**Why a hard-coded constant, not env:** the epoch index is a public
input to every PLONK proof and is bound on-chain by
`LotteryAmoeRouter.allowlistRootOf` / `pointsLedgerRootOf`. Allowing the
publisher to differ from the prover by even one epoch would silently
desync every downstream proof. Pinning here means both modules import
the same value at module load.

**Single source of truth:** `amoeSubmitZk.ts` re-exports this value
(under the legacy name `AMOE_EPOCH_GENESIS_UNIX_SEC`) so that the
submit-handler and the points-burn-ledger publisher cannot drift
apart. A regression test in `amoeSubmitZk.test.ts` asserts the two
names point at the same bigint.

**Mutation forbidden post-launch:** changing this value is equivalent
to invalidating every previously-published epoch root and would brick
every in-flight proof. Treat it as a circuit constant.

***

### AMOE\_EPOCH\_GRACE\_SECONDS

> `const` **AMOE\_EPOCH\_GRACE\_SECONDS**: `60n`

Defined in: [server/\_lib/lottery/amoeWitness.ts:166](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L166)

Grace window (in seconds) the publisher waits past `epoch_close(E)`
before declaring epoch `E` eligible for projection / publishing. This
absorbs clock skew between API servers, the publisher cron, and the
database — a row written 30s before `epoch_close(E)` with a server
clock that is 30s fast can land in the database 60s after the boundary,
and we want it to land in epoch `E`'s snapshot, not `E+1`'s.

60 seconds is well above worst-case observed Postgres / API clock
drift. Increase only if monitoring shows late-arriving rows.

***

### AMOE\_EPOCH\_LENGTH\_SECONDS

> `const` **AMOE\_EPOCH\_LENGTH\_SECONDS**: `86400n`

Defined in: [server/\_lib/lottery/amoeWitness.ts:153](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L153)

Length of one AMOE epoch in seconds — 86400 = 1 UTC day.

**Pinned value:** the daily cadence is locked into the circuit (see
`amoeWitness.ts:102` epoch-is-daily comment and the daily rhythm of
`amoe_twitter_daily` / `amoe_checkin` in the points ledger). Changing
this post-launch would require a circuit regeneration — it is not a
v1 decision, it is a constant.

***

### AMOE\_MAX\_CREATOR\_COIN\_ADDR

> `const` **AMOE\_MAX\_CREATOR\_COIN\_ADDR**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L98)

Maximum value for `creatorCoinAddr`. Mirrors `Num2Bits(160)` in
`amoe_eligibility.circom` line 153. EVM addresses are 160-bit, so this
is exactly the 20-byte address space.

***

### AMOE\_MAX\_EPOCH

> `const` **AMOE\_MAX\_EPOCH**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L105)

Maximum value for `epoch`. Mirrors `Num2Bits(64)` in
`amoe_eligibility.circom` line 157. Epoch is the daily counter
(uint64 on-chain), so 64 bits gives ~5 × 10^11 years of headroom.

***

### AMOE\_MAX\_POINTS\_BURNED\_AS\_USD

> `const` **AMOE\_MAX\_POINTS\_BURNED\_AS\_USD**: `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:112](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L112)

Maximum value for `pointsBurnedAsUSD` (the circuit's Num2Bits(64) bound).
The Solidity / business-rule cap (100..1_000_000 points ⇒ 1_000_000..
10_000_000_000 USD-cents) is much smaller and enforced elsewhere.

## Functions

### assembleAmoeWitness()

> **assembleAmoeWitness**(`args`): [`AmoeEligibilityWitness`](proveAmoeEntryPlonk.md#amoeeligibilitywitness)

Defined in: [server/\_lib/lottery/amoeWitness.ts:580](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L580)

Assemble a fully-populated, circuit-ready `AmoeEligibilityWitness` from
raw inputs and the day's two Merkle snapshots.

Validation performed (in order):
  1. Every raw input is a non-negative bigint < BN254 field modulus.
  2. Bit-bounds: `creatorCoinAddr` ≤ 2^160 - 1, `epoch` ≤ 2^64 - 1,
     `pointsBurnedAsUSD` ≤ 2^64 - 1.
  3. Both snapshots have the expected sparse shape.
  4. Computed allowlist leaf at `allowlistLeafIndex` matches the
     snapshot's level-0 entry at that index.
  5. Computed ledger leaf at `pointsLedgerLeafIndex` matches the
     snapshot's level-0 entry at that index.
  6. (Defensive) The Merkle path produced by `getAmoeMerklePath`
     verifies against the snapshot root — catches off-by-one bugs
     locally rather than 5-30s into a snarkjs prove.

Returns an object whose shape is exactly `AmoeEligibilityWitness` from
`proveAmoeEntryPlonk.ts`. All bigints are returned as bigints (snarkjs
accepts both `bigint` and decimal-string; we stay in bigint until the
very last serialization step in the prover wrapper).

#### Parameters

##### args

[`AssembleAmoeWitnessArgs`](#assembleamoewitnessargs)

#### Returns

[`AmoeEligibilityWitness`](proveAmoeEntryPlonk.md#amoeeligibilitywitness)

#### Throws

on any structural / bounds / inclusion
        failure. Code is always `'plonk_witness_input_invalid'`.

***

### buildAmoeAllowlistSnapshotFromSingleWallet()

> **buildAmoeAllowlistSnapshotFromSingleWallet**(`wallet`, `epoch`): [`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

Defined in: [server/\_lib/lottery/amoeWitness.ts:825](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L825)

Build a single-leaf snapshot — the wallet's allowlist leaf at index 0,
with the rest zero-padded. Useful for fixture parity tests where the
canonical input has all-zero `pathElements` (i.e. the only real leaf is
at position 0) and as a starting point for end-to-end integration
before the daily publisher is wired up.

#### Parameters

##### wallet

`bigint`

##### epoch

`bigint`

#### Returns

[`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

***

### buildAmoeLedgerSnapshotFromSingleEntry()

> **buildAmoeLedgerSnapshotFromSingleEntry**(`args`): [`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

Defined in: [server/\_lib/lottery/amoeWitness.ts:839](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L839)

Build a single-leaf points-burn ledger snapshot for the given burn row.
Mirrors the shape used by the canonical fixture (single leaf at index
0). Production publishers will replace this with a multi-leaf builder
once the ledger source-of-truth design (#403 §2) is finalized.

#### Parameters

##### args

###### epoch

`bigint`

###### pointsBurnedAsUSD

`bigint`

###### signupIdHash

`bigint`

###### spendRefIdHash

`bigint`

###### walletAddrCommit

`bigint`

#### Returns

[`AmoeMerkleSnapshot`](amoeMerkleTree.md#amoemerklesnapshot)

***

### canonicalizeAmoeBytes32ToField()

> **canonicalizeAmoeBytes32ToField**(`name`, `v`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:382](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L382)

Reduce a bytes32-domain bigint to a canonical BN254 field element.

RATIONALE
=========
Several AMOE inputs are produced as random / opaque 32-byte values
before the witness layer ever sees them:

  * `nonce` — server emits `randomBytes(32)`; ~81% of those exceed `Q`.
    (See `lotteryAmoe.ts::issueAmoeNonce`.)
  * `twitterCreditNullifier`, `signupIdHash`, `spendRefIdHash` —
    hash-derived identifiers from off-chain stores; same situation.

The PLONK circuit, like all circom-on-BN254 circuits, can only consume
field elements in `[0, Q)`. Hard-rejecting any bytes32 above `Q` would
break ~81% of legitimate entries. The standard remediation is to
canonicalize at the witness boundary by reducing mod `Q` — the same
convention `circomlibjs` uses for its native bytes32 → field helpers.

SAFETY
======
Reduction is structure-preserving: two bytes32 values that differ
only by a multiple of `Q` collide post-reduction. With Q being
~2^254, collisions on uniformly-random bytes32 are exactly when the
upper 2 bits of the bytes32 represent the same `floor(v / Q)` value
AND the lower bits match — i.e. ~2^-254 per pair, completely
negligible. For the AMOE replay/nullifier guarantees this is the
same security level as if the issuer had emitted a 254-bit value.

The reduction MUST be applied identically by every component that
recomputes a commit (server, contract that re-derives, future
publisher) so the same on-chain `nonceCommit` falls out regardless
of which side computes it. This module is the source of truth.

VALIDATION
==========
Inputs must be a non-negative bigint with `v <= 2^256 - 1`. Anything
larger almost certainly indicates a caller-side parse bug (e.g. a
33-byte buffer parsed as a bigint, or a negative bigint coerced via
two's complement) and we throw `plonk_witness_input_invalid` rather
than silently reducing it.

#### Parameters

##### name

`string`

##### v

`unknown`

#### Returns

`bigint`

***

### computeAmoeAllowlistLeaf()

> **computeAmoeAllowlistLeaf**(`wallet`, `epoch`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:462](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L462)

Allowlist leaf — `Poseidon2(wallet, epoch)`. The publisher uses the same
function when building the daily allowlist snapshot, so caller-vs-tree
is guaranteed in-sync.

#### Parameters

##### wallet

`bigint`

##### epoch

`bigint`

#### Returns

`bigint`

***

### computeAmoeLedgerLeaf()

> **computeAmoeLedgerLeaf**(`signupIdHash`, `spendRefIdHash`, `pointsBurnedAsUSD`, `epoch`, `walletAddrCommit`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:478](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L478)

Points-burn ledger leaf — `Poseidon5(signupIdHash, spendRefIdHash,
pointsBurnedAsUSD, epoch, walletAddrCommit)`.

The leaf binds the burn row to the wallet *commit* (not the wallet
itself), so the ledger publisher only needs the public commit — which
keeps the published ledger zero-knowledge with respect to wallet
addresses.

#### Parameters

##### signupIdHash

`bigint`

##### spendRefIdHash

`bigint`

##### pointsBurnedAsUSD

`bigint`

##### epoch

`bigint`

##### walletAddrCommit

`bigint`

#### Returns

`bigint`

***

### computeAmoeNonceCommit()

> **computeAmoeNonceCommit**(`nonce`, `wallet`, `creatorCoinAddr`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:428](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L428)

`nonceCommit = Poseidon3(nonce, wallet, creatorCoinAddr)`. Binds the
nonce to a specific (wallet, creator) pair so a nonce can't be replayed
across creators or wallets. Public signal.

#### Parameters

##### nonce

`bigint`

##### wallet

`bigint`

##### creatorCoinAddr

`bigint`

#### Returns

`bigint`

***

### computeAmoePointsBurnNullifier()

> **computeAmoePointsBurnNullifier**(`signupIdHash`, `spendRefIdHash`, `pointsBurnedAsUSD`, `epoch`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:448](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L448)

`pointsBurnNullifier = Poseidon4(signupIdHash, spendRefIdHash,
pointsBurnedAsUSD, epoch)`. Public signal — the on-chain replay store
tracks these to forbid double-spending the same burn row.

Note the absence of `wallet` from the inputs: the binding to wallet is
via `walletAddrCommit` being a separate public signal that the contract
cross-checks against `msg.sender`. That keeps this nullifier
deterministic per burn row regardless of the wallet that submits it,
which is required for the "any wallet may sweep an unclaimed burn"
design currently locked.

#### Parameters

##### signupIdHash

`bigint`

##### spendRefIdHash

`bigint`

##### pointsBurnedAsUSD

`bigint`

##### epoch

`bigint`

#### Returns

`bigint`

***

### computeAmoeWalletAddrCommit()

> **computeAmoeWalletAddrCommit**(`wallet`, `twitterCreditNullifier`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:416](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L416)

`walletAddrCommit = Poseidon2(wallet, twitterCreditNullifier)`. This is
the public signal used on-chain to identify the entry without revealing
the wallet ↔ credential binding.

#### Parameters

##### wallet

`bigint`

##### twitterCreditNullifier

`bigint`

#### Returns

`bigint`

***

### currentAmoeEpoch()

> **currentAmoeEpoch**(`nowMs`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:213](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L213)

Return the current AMOE epoch given a wall-clock millisecond timestamp
(e.g. `Date.now()`). Pure helper — no I/O, no dependency on the system
clock at module-load time.

#### Parameters

##### nowMs

`number`

#### Returns

`bigint`

***

### epochCloseAt()

> **epochCloseAt**(`epoch`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:201](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L201)

Compute the close-time of epoch `E`, in Unix seconds.

`epoch_close(E) = genesis + (E + 1) * length`. A row whose
`created_at >= epoch_close(E)` belongs to epoch `E+1`, not `E`.

#### Parameters

##### epoch

`bigint`

#### Returns

`bigint`

***

### epochForTimestamp()

> **epochForTimestamp**(`createdAtSeconds`): `bigint`

Defined in: [server/\_lib/lottery/amoeWitness.ts:180](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L180)

Compute the AMOE epoch index for a `created_at` timestamp.

#### Parameters

##### createdAtSeconds

`bigint`

Unix timestamp in seconds (UTC). Bigint to avoid
                        the JS-number 53-bit cliff for far-future
                        epochs.

#### Returns

`bigint`

The epoch counter `E` such that `genesis + E*length <=
         createdAt < genesis + (E+1)*length`.

#### Throws

Range error (as a plain `Error` — not an AmoeProofGenerationError
         since this is not a witness-time check) if `createdAt` is
         before genesis.

***

### isAmoeEpochEligibleForPublish()

> **isAmoeEpochEligibleForPublish**(`epoch`, `nowMs`): `boolean`

Defined in: [server/\_lib/lottery/amoeWitness.ts:222](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lottery/amoeWitness.ts#L222)

Returns true iff epoch `E` is eligible for projection / publishing —
i.e. its close-time plus the grace window has passed. Used by the
publisher cron to decide which epochs to materialize.

#### Parameters

##### epoch

`bigint`

##### nowMs

`number`

#### Returns

`boolean`
