[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/cswOwner

# server/\_lib/wallet/cswOwner

## Functions

### isCswOwner()

> **isCswOwner**(`ownerAddress`, `cswAddress`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/wallet/cswOwner.ts:105](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwner.ts#L105)

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

Defined in: [server/\_lib/wallet/cswOwner.ts:159](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/wallet/cswOwner.ts#L159)

Verify that a contract address is a genuine Coinbase Smart Wallet by checking
its `entryPoint` and `implementation` against known CSW factories.
Returns true only if both match the expected protocol values.

#### Parameters

##### cswAddress

`string`

#### Returns

`Promise`\<`boolean`\>
