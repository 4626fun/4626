[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/accountSetup/shared

# src/features/accountSetup/shared

## Variables

### PROVIDER\_ROWS

> `const` **PROVIDER\_ROWS**: [`ProviderRow`](types.md#providerrow)[]

Defined in: [src/features/accountSetup/shared.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/shared.ts#L3)

## Functions

### deriveOwnerAuthorityState()

> **deriveOwnerAuthorityState**(`input`): [`OwnerAuthorityState`](types.md#ownerauthoritystate)

Defined in: [src/features/accountSetup/shared.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/shared.ts#L35)

#### Parameters

##### input

###### canonicalCswAddress

`string` \| `null`

###### connectedAddress

`string` \| `null` \| `undefined`

###### connectedCanonicalWalletSelected

`boolean`

###### connectedOwnerState

[`ConnectedOwnerState`](types.md#connectedownerstate)

#### Returns

[`OwnerAuthorityState`](types.md#ownerauthoritystate)

***

### hasResolvedZoraSignals()

> **hasResolvedZoraSignals**(`data`): `boolean`

Defined in: [src/features/accountSetup/shared.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/shared.ts#L19)

#### Parameters

##### data

[`ZoraResolveResponse`](types.md#zoraresolveresponse) | `null` | `undefined`

#### Returns

`boolean`

***

### isMobileWalletEnvironment()

> **isMobileWalletEnvironment**(): `boolean`

Defined in: [src/features/accountSetup/shared.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/shared.ts#L29)

#### Returns

`boolean`

***

### shortValue()

> **shortValue**(`value`): `string`

Defined in: [src/features/accountSetup/shared.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/shared.ts#L13)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string`

***

### sleep()

> **sleep**(`ms`): `Promise`\<`void`\>

Defined in: [src/features/accountSetup/shared.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/accountSetup/shared.ts#L25)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>
