[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/alfaclub

# server/\_lib/wallet/alfaclub

## Type Aliases

### AlfaClubHolding

> **AlfaClubHolding** = `object`

Defined in: [server/\_lib/wallet/alfaclub.ts:73](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L73)

#### Properties

##### balance

> **balance**: `bigint`

Defined in: [server/\_lib/wallet/alfaclub.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L77)

Current ERC-1155 balance of the queried address for this tokenId.

##### creator

> **creator**: `Address`

Defined in: [server/\_lib/wallet/alfaclub.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L79)

Creator address resolved via creatorByTokenId(tokenId).

##### tokenId

> **tokenId**: `bigint`

Defined in: [server/\_lib/wallet/alfaclub.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L75)

FriendKey tokenId (one per room/creator).

***

### AlfaClubHoldingsResult

> **AlfaClubHoldingsResult** = `object`

Defined in: [server/\_lib/wallet/alfaclub.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L82)

#### Properties

##### address

> **address**: `Address`

Defined in: [server/\_lib/wallet/alfaclub.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L83)

##### holdings

> **holdings**: [`AlfaClubHolding`](#alfaclubholding)[]

Defined in: [server/\_lib/wallet/alfaclub.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L84)

##### isCreator

> **isCreator**: `boolean`

Defined in: [server/\_lib/wallet/alfaclub.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L86)

True if the queried address is the creator of at least one held key.

##### isHolder

> **isHolder**: `boolean`

Defined in: [server/\_lib/wallet/alfaclub.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L88)

True if the queried address holds any AlfaClub keys at all.

***

### AlfaClubPublicClientLike

> **AlfaClubPublicClientLike** = `object`

Defined in: [server/\_lib/wallet/alfaclub.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L92)

Narrow viem-like interface so call sites can inject mock clients in tests.

#### Properties

##### getLogs()

> **getLogs**: (`args`) => `Promise`\<`ReadonlyArray`\<`unknown`\>\>

Defined in: [server/\_lib/wallet/alfaclub.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L93)

###### Parameters

###### args

`unknown`

###### Returns

`Promise`\<`ReadonlyArray`\<`unknown`\>\>

##### multicall()?

> `optional` **multicall**: (`args`) => `Promise`\<`ReadonlyArray`\<`unknown`\>\>

Defined in: [server/\_lib/wallet/alfaclub.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L95)

###### Parameters

###### args

`unknown`

###### Returns

`Promise`\<`ReadonlyArray`\<`unknown`\>\>

##### readContract()

> **readContract**: (`args`) => `Promise`\<`unknown`\>

Defined in: [server/\_lib/wallet/alfaclub.ts:94](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L94)

###### Parameters

###### args

`unknown`

###### Returns

`Promise`\<`unknown`\>

## Variables

### ALFACLUB

> `const` **ALFACLUB**: `object`

Defined in: [server/\_lib/wallet/alfaclub.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L28)

#### Type Declaration

##### chainId

> `readonly` **chainId**: `8453` = `8453`

##### friendKey

> `readonly` **friendKey**: `string`

##### friendPool

> `readonly` **friendPool**: `string`

##### friendStakeBeacon

> `readonly` **friendStakeBeacon**: `string`

***

### ALFACLUB\_CORE\_ADDRESSES

> `const` **ALFACLUB\_CORE\_ADDRESSES**: `ReadonlySet`\<`string`\>

Defined in: [server/\_lib/wallet/alfaclub.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L36)

Lowercased set of the three core AlfaClub contract addresses.

***

### FRIEND\_KEY\_ABI

> `const` **FRIEND\_KEY\_ABI**: readonly \[\{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}, \{ \}\]

Defined in: [server/\_lib/wallet/alfaclub.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L48)

Minimal FriendKey ABI. Captures only the view functions + events we read.
Full ABI lives in https://github.com/FriendDotSpace/contracts.

***

### ZERO\_ADDRESS

> `const` **ZERO\_ADDRESS**: `"0x0000000000000000000000000000000000000000"`

Defined in: [server/\_lib/wallet/alfaclub.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L42)

## Functions

### \_resetAlfaClubPublicClientForTests()

> **\_resetAlfaClubPublicClientForTests**(): `void`

Defined in: [server/\_lib/wallet/alfaclub.ts:378](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L378)

Reset the cached client. Exposed for tests.

#### Returns

`void`

***

### getAlfaClubCreatorTokenId()

> **getAlfaClubCreatorTokenId**(`creator`, `client`, `opts?`): `Promise`\<`bigint` \| `null`\>

Defined in: [server/\_lib/wallet/alfaclub.ts:326](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L326)

Reverse lookup: find the FriendKey tokenId a creator initially received.

AlfaClub mints the first share of a new room to the creator (TransferSingle
with from=0x0, to=creator). We grab the earliest such log and return its id.

Returns null if no mint event is found for the address.

#### Parameters

##### creator

`string`

##### client

[`AlfaClubPublicClientLike`](#alfaclubpublicclientlike)

##### opts?

###### fromBlock?

`bigint`

###### toBlock?

`bigint` \| `"latest"`

#### Returns

`Promise`\<`bigint` \| `null`\>

***

### getAlfaClubHoldings()

> **getAlfaClubHoldings**(`address`, `client`, `opts?`): `Promise`\<[`AlfaClubHoldingsResult`](#alfaclubholdingsresult)\>

Defined in: [server/\_lib/wallet/alfaclub.ts:232](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L232)

Resolve current AlfaClub FriendKey holdings for `address`.

Algorithm:
  1. Scan TransferSingle/TransferBatch logs (to=address) for candidate tokenIds.
  2. Read current balanceOf(address, tokenId) for each candidate, in parallel.
  3. Drop zero balances.
  4. Resolve creatorByTokenId(tokenId) for the surviving set.

Returns an empty result on any RPC error (fail-open; labeling is optional).

#### Parameters

##### address

`string`

##### client

[`AlfaClubPublicClientLike`](#alfaclubpublicclientlike)

##### opts?

###### fromBlock?

`bigint`

###### toBlock?

`bigint` \| `"latest"`

#### Returns

`Promise`\<[`AlfaClubHoldingsResult`](#alfaclubholdingsresult)\>

***

### getAlfaClubPublicClient()

> **getAlfaClubPublicClient**(): `Promise`\<[`AlfaClubPublicClientLike`](#alfaclubpublicclientlike)\>

Defined in: [server/\_lib/wallet/alfaclub.ts:362](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L362)

Build (or reuse) a viem PublicClient pinned to Base for AlfaClub reads.
Resolution order: BASE_LOGS_RPC_URL > BASE_RPC_URL > public.

#### Returns

`Promise`\<[`AlfaClubPublicClientLike`](#alfaclubpublicclientlike)\>

***

### scanAddressTransferredTokenIds()

> **scanAddressTransferredTokenIds**(`address`, `client`, `opts?`): `Promise`\<`bigint`[]\>

Defined in: [server/\_lib/wallet/alfaclub.ts:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/alfaclub.ts#L152)

Return the set of distinct FriendKey tokenIds an address has ever received.

Uses TransferSingle + TransferBatch logs filtered by `to = address`.
Does not guarantee current balance > 0; caller must filter with balanceOf.

#### Parameters

##### address

`string`

##### client

[`AlfaClubPublicClientLike`](#alfaclubpublicclientlike)

##### opts?

###### blockChunk?

`bigint`

###### fromBlock?

`bigint`

###### toBlock?

`bigint` \| `"latest"`

#### Returns

`Promise`\<`bigint`[]\>
