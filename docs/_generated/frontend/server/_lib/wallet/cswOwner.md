[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/cswOwner

# server/\_lib/wallet/cswOwner

## Functions

### isCswOwner()

> **isCswOwner**(`ownerAddress`, `cswAddress`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/wallet/cswOwner.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/cswOwner.ts#L105)

#### Parameters

##### ownerAddress

`string`

##### cswAddress

`string`

#### Returns

`Promise`\<`boolean`\>

***

### verifyCswProvenance()

> **verifyCswProvenance**(`cswAddress`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/wallet/cswOwner.ts:159](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/cswOwner.ts#L159)

Verify that a contract address is a genuine Coinbase Smart Wallet by checking
its `entryPoint` and `implementation` against known CSW factories.
Returns true only if both match the expected protocol values.

#### Parameters

##### cswAddress

`string`

#### Returns

`Promise`\<`boolean`\>
