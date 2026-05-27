[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-csw/enrichOwners

# server/\_lib/zora-csw/enrichOwners

## Type Aliases

### EnrichedOwners

> **EnrichedOwners** = `object`

Defined in: [server/\_lib/zora-csw/enrichOwners.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/enrichOwners.ts#L50)

#### Properties

##### addressOwners

> **addressOwners**: `Address`[]

Defined in: [server/\_lib/zora-csw/enrichOwners.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/enrichOwners.ts#L52)

EOA owners currently installed on the CSW (checksummed).

##### nextOwnerIndex

> **nextOwnerIndex**: `bigint` \| `null`

Defined in: [server/\_lib/zora-csw/enrichOwners.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/enrichOwners.ts#L56)

Result of `nextOwnerIndex` at read time; null if the call reverted.

##### passkeyOwnerCount

> **passkeyOwnerCount**: `number`

Defined in: [server/\_lib/zora-csw/enrichOwners.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/enrichOwners.ts#L54)

Passkey owners (raw bytes); included for completeness, not stored.

##### removedOwnersCount

> **removedOwnersCount**: `bigint` \| `null`

Defined in: [server/\_lib/zora-csw/enrichOwners.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/enrichOwners.ts#L58)

Result of `removedOwnersCount` at read time; null if the call reverted.

## Variables

### MAX\_OWNER\_INDEX

> `const` **MAX\_OWNER\_INDEX**: `64` = `64`

Defined in: [server/\_lib/zora-csw/enrichOwners.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/enrichOwners.ts#L48)

Hard ceiling on owner enumeration — defends against pathological loops.

## Functions

### enrichCswOwners()

> **enrichCswOwners**(`client`, `cswAddress`): `Promise`\<[`EnrichedOwners`](#enrichedowners)\>

Defined in: [server/\_lib/zora-csw/enrichOwners.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/enrichOwners.ts#L76)

Enumerate current owners of a Coinbase Smart Wallet.

The contract stores owners at indices 0..nextOwnerIndex-1, but
indices can be "removed" (returned as empty bytes) when someone
calls `removeOwnerAtIndex`. We skip those gracefully.

Owner encoding:
  - 32 bytes  → address (abi-encoded; address occupies low 20 bytes)
  - 64 bytes  → passkey (x, y of a P-256 public key)
  - 0 bytes   → slot was removed

Only address owners can sign a plain `addOwnerAddress` tx, which is
what the install flow needs — so we surface those separately.

#### Parameters

##### client

##### cswAddress

`string`

#### Returns

`Promise`\<[`EnrichedOwners`](#enrichedowners)\>
