[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/amoeIdentifiers

# server/\_lib/lottery/amoeIdentifiers

## Variables

### AMOE\_SIGNUP\_SALT\_LENGTH\_BYTES

> `const` **AMOE\_SIGNUP\_SALT\_LENGTH\_BYTES**: `32`

Defined in: [server/\_lib/lottery/amoeIdentifiers.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeIdentifiers.ts#L74)

Length, in bytes, of the AMOE signup salt. Pinned to 32 — matches the
keccak256 block size and the runbook in
`docs/operations/deployment/amoe-signup-salt-provisioning.md`.

## Functions

### bigintToBe32Bytes()

> **bigintToBe32Bytes**(`value`): `Uint8Array`

Defined in: [server/\_lib/lottery/amoeIdentifiers.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeIdentifiers.ts#L120)

Encode a non-negative bigint as a 32-byte big-endian buffer.

Why big-endian + zero-pad: matches Solidity's `abi.encodePacked(uint256)`
representation, so any future on-chain re-derivation (e.g. a verifier
that wants to recompute `signupIdHash` from a public `profiles.id`)
lines up byte-for-byte without an off-chain conversion shim.

#### Parameters

##### value

`bigint`

#### Returns

`Uint8Array`

#### Throws

AmoeServerError if `value` is negative or exceeds 2^256 - 1.

***

### deriveSignupIdHash()

> **deriveSignupIdHash**(`args`): `bigint`

Defined in: [server/\_lib/lottery/amoeIdentifiers.ts:228](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeIdentifiers.ts#L228)

Derive the `signupIdHash` private input.

  keccak256(bigintToBe32Bytes(profileId) ‖ salt) → bigint, then mod Q

`profileId` is the Postgres bigint primary key from `profiles.id`,
resolved upstream by `resolveAmoeWallet` (which already follows the
`merged_into_profile_id` tombstone chain).

#### Parameters

##### args

###### profileId

`number` \| `bigint`

###### salt

`Uint8Array`

#### Returns

`bigint`

***

### deriveSpendRefIdHash()

> **deriveSpendRefIdHash**(`args`): `bigint`

Defined in: [server/\_lib/lottery/amoeIdentifiers.ts:254](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeIdentifiers.ts#L254)

Derive the `spendRefIdHash` private input.

  keccak256(utf8(spendRefId) ‖ salt) → bigint, then mod Q

`spendRefId` is the opaque external reference for the points-burn
row (UUID, idempotency key, etc.). Unlike `signupIdHash`, this value
is never re-derived in a different context — its only consumer is
the ledger projection that stores `spendRefIdHash` directly. So
format flexibility (UUID, hex, opaque token) is fine here.

#### Parameters

##### args

###### salt

`Uint8Array`

###### spendRefId

`string`

#### Returns

`bigint`

***

### deriveTwitterCreditNullifier()

> **deriveTwitterCreditNullifier**(`args`): `bigint`

Defined in: [server/\_lib/lottery/amoeIdentifiers.ts:204](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeIdentifiers.ts#L204)

Derive the `twitterCreditNullifier` private input.

  keccak256(utf8(normaliseTwitterHandle(handle)) ‖ salt) → bigint, then mod Q

Domain: bytes32 (we canonicalize). The witness module re-applies
canonicalization defensively — passing an already-canonical value is
idempotent.

#### Parameters

##### args

###### salt

`Uint8Array`

###### twitterHandle

`string`

#### Returns

`bigint`

***

### normaliseTwitterHandle()

> **normaliseTwitterHandle**(`handle`): `string`

Defined in: [server/\_lib/lottery/amoeIdentifiers.ts:189](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeIdentifiers.ts#L189)

Normalise a Twitter handle for nullifier derivation: trim, strip a
leading `@`, lowercase. Same handle entered as `@Wenakita` and
`wenakita` MUST produce the same nullifier so the daily-checkin
ledger can dedupe; this function is the single source of truth.

#### Parameters

##### handle

`string`

#### Returns

`string`

***

### readAmoeSignupSalt()

> **readAmoeSignupSalt**(): `Uint8Array`

Defined in: [server/\_lib/lottery/amoeIdentifiers.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/amoeIdentifiers.ts#L91)

Read + validate `AMOE_SIGNUP_SALT` from the environment. The salt is a
lower- or upper-case hex string of exactly 64 hex chars (32 bytes),
with or without a leading `0x`. Malformed or missing salt throws
`AmoeServerError('amoe_signup_salt_misconfigured')` — handlers should
map that to a 5xx (NOT 4xx) so a misconfigured deployment doesn't
silently serve insecure nullifiers.

Why an env var (and not Vercel KV / Supabase secret): the salt must
be available synchronously at module load to keep the hot path free
of network reads, and it must NEVER be readable from the database
(otherwise a SQL injection that leaks `signupIdHash` rows could be
combined with a salt leak to deanonymize the ledger). Vercel
encrypted env is the right primitive.

#### Returns

`Uint8Array`
