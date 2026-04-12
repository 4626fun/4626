[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/cswOwner

# server/\_lib/cswOwner

## Functions

### isCswOwner()

> **isCswOwner**(`ownerAddress`, `cswAddress`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/cswOwner.ts:105](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/cswOwner.ts#L105)

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

Defined in: [server/\_lib/cswOwner.ts:159](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/cswOwner.ts#L159)

Verify that a contract address is a genuine Coinbase Smart Wallet by checking
its `entryPoint` and `implementation` against known CSW factories.
Returns true only if both match the expected protocol values.

#### Parameters

##### cswAddress

`string`

#### Returns

`Promise`\<`boolean`\>
