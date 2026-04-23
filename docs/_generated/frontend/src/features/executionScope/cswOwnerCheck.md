[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/executionScope/cswOwnerCheck

# src/features/executionScope/cswOwnerCheck

## Type Aliases

### CswOwnerCandidate

> **CswOwnerCandidate** = `object`

Defined in: [src/features/executionScope/cswOwnerCheck.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/cswOwnerCheck.ts#L37)

#### Properties

##### address

> **address**: `Address`

Defined in: [src/features/executionScope/cswOwnerCheck.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/cswOwnerCheck.ts#L52)

##### label

> **label**: `"smart_wallet"` \| `"external"` \| `"embedded"`

Defined in: [src/features/executionScope/cswOwnerCheck.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/cswOwnerCheck.ts#L51)

- `smart_wallet` — 4626's own Privy app smart wallet (via
  `useSmartWallets`). ERC-4337 account; when it is on the CSW owner
  list (installed by the waitlist "Enable 4626 signing" step), its
  `signTypedData` produces an ERC-1271 signature that the commit
  endpoint validates via `parentCsw.isValidSignature`.
- `external` — a connected browser EOA (Rabby / MetaMask / CBW).
  Relevant for power users who manually add their own EOA as an
  owner of the CSW.
- `embedded` — the 4626 Privy embedded EOA. Almost never an owner
  of a Zora-cross-app CSW; kept as a low-priority candidate so the
  few rare cases still work.

***

### CswOwnerResult

> **CswOwnerResult** = [`CswOwnerCandidate`](#cswownercandidate) & `object`

Defined in: [src/features/executionScope/cswOwnerCheck.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/cswOwnerCheck.ts#L55)

#### Type Declaration

##### isOwner

> **isOwner**: `boolean`

## Variables

### COINBASE\_SMART\_WALLET\_OWNER\_CHECK\_ABI

> `const` **COINBASE\_SMART\_WALLET\_OWNER\_CHECK\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"account"`; `type`: `"address"`; \}\]; `name`: `"isOwnerAddress"`; `outputs`: readonly \[\{ `name`: `""`; `type`: `"bool"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/features/executionScope/cswOwnerCheck.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/cswOwnerCheck.ts#L27)

Shared helpers for checking CoinbaseSmartWallet ownership of a given
EOA against the parent CSW. Used by both:

  - `useAutoProvisionSubAccount` — to decide whether auto-provision
    is safe to fire without a user click
  - the `ExecutionScopeCard` `not_provisioned` state — to show the
    user which of their connected signers will be used for the
    SpendPermission signature

We check the Privy embedded EOA AND any currently-connected external
EOA (Rabby / MetaMask / Coinbase Wallet). Either one qualifies — the
/api/arch-b/sub-account/provision/commit endpoint accepts signatures
from any EOA that passes `CoinbaseSmartWallet.isOwnerAddress` (plus
ERC-1271 fallback) on the parent CSW.

This is specifically important for Zora-cross-app profiles whose CSW
was created outside Privy — the Privy embedded EOA isn't on the CSW
owner list, but the user's existing Rabby / MetaMask likely is. Arch B
is designed for exactly this scenario: the sub-account co-ownership
lets the embedded EOA sign *sub-account* UserOps after one-time
SpendPermission signing from a parent-CSW owner.

## Functions

### checkCswOwners()

> **checkCswOwners**(`args`): `Promise`\<[`CswOwnerResult`](#cswownerresult)[]\>

Defined in: [src/features/executionScope/cswOwnerCheck.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/cswOwnerCheck.ts#L70)

Query `isOwnerAddress(candidate)` on the parent CSW for each
candidate in parallel. Candidates with unreadable addresses or
failing RPC calls surface as `isOwner: false`; we don't throw,
because the card should still render a reasonable empty state if
the RPC briefly fails.

Returns the candidates in the order they were passed in. The
auto-provision hook prefers external-over-embedded when picking a
signer, because external wallets (Rabby / MetaMask / CBW) are
typically the ones actually on the CSW owner list for Zora-cross-app
flows.

#### Parameters

##### args

###### candidates

[`CswOwnerCandidate`](#cswownercandidate)[]

###### csw

`` `0x${string}` ``

###### publicClient

`Pick`\<`PublicClient`, `"readContract"`\>

#### Returns

`Promise`\<[`CswOwnerResult`](#cswownerresult)[]\>

***

### pickOwnerSigner()

> **pickOwnerSigner**(`results`): [`CswOwnerResult`](#cswownerresult) \| `null`

Defined in: [src/features/executionScope/cswOwnerCheck.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/cswOwnerCheck.ts#L112)

Pick the preferred signer for a fresh SpendPermission signature.

Preference order (highest first):
  1. 4626 Privy app smart wallet (ERC-1271) — the universal path for
     Zora-cross-app users who completed the waitlist owner-install
     step. Works without any external wallet connection, no passkey
     popup, consistent UX.
  2. External EOA (Rabby / MetaMask / CBW) that is a CSW owner —
     for power users like profile 1 who manually added their own
     EOA to the CSW owner list.
  3. Privy embedded EOA if it is a CSW owner — extremely rare path,
     only applies to accounts created directly through 4626 Privy
     without cross-app (not the normal production flow).
  4. null — nothing available to sign with; the card should prompt
     the user to complete owner install or connect an owner wallet.

#### Parameters

##### results

[`CswOwnerResult`](#cswownerresult)[]

#### Returns

[`CswOwnerResult`](#cswownerresult) \| `null`
