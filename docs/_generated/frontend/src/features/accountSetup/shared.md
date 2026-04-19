[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/accountSetup/shared

# src/features/accountSetup/shared

## Variables

### PROVIDER\_ROWS

> `const` **PROVIDER\_ROWS**: [`ProviderRow`](types.md#providerrow)[]

Defined in: [src/features/accountSetup/shared.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/accountSetup/shared.ts#L3)

## Functions

### deriveOwnerAuthorityState()

> **deriveOwnerAuthorityState**(`input`): [`OwnerAuthorityState`](types.md#ownerauthoritystate)

Defined in: [src/features/accountSetup/shared.ts:41](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/accountSetup/shared.ts#L41)

#### Parameters

##### input

###### canonicalCswAddress

`string` \| `null`

###### connectedAddress

`string` \| `null` \| `undefined`

###### connectedCanonicalWalletSelected

`boolean`

###### connectedOwnerState

\{ `reason`: `"ok"` \| `"idle"` \| `"network_mismatch"` \| `"missing_params"` \| `"read_failed"`; `value`: `boolean` \| `null`; \}

###### connectedOwnerState.reason

`"ok"` \| `"idle"` \| `"network_mismatch"` \| `"missing_params"` \| `"read_failed"`

###### connectedOwnerState.value

`boolean` \| `null`

#### Returns

[`OwnerAuthorityState`](types.md#ownerauthoritystate)

***

### hasResolvedZoraSignals()

> **hasResolvedZoraSignals**(`data`): `boolean`

Defined in: [src/features/accountSetup/shared.ts:25](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/accountSetup/shared.ts#L25)

#### Parameters

##### data

[`ZoraResolveResponse`](types.md#zoraresolveresponse) | `null` | `undefined`

#### Returns

`boolean`

***

### isMobileWalletEnvironment()

> **isMobileWalletEnvironment**(): `boolean`

Defined in: [src/features/accountSetup/shared.ts:35](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/accountSetup/shared.ts#L35)

#### Returns

`boolean`

***

### normalizeAddress()

> **normalizeAddress**(`value`): `string` \| `null`

Defined in: [src/features/accountSetup/shared.ts:13](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/accountSetup/shared.ts#L13)

#### Parameters

##### value

`string`

#### Returns

`string` \| `null`

***

### shortValue()

> **shortValue**(`value`): `string`

Defined in: [src/features/accountSetup/shared.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/accountSetup/shared.ts#L19)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string`

***

### sleep()

> **sleep**(`ms`): `Promise`\<`void`\>

Defined in: [src/features/accountSetup/shared.ts:31](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/accountSetup/shared.ts#L31)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>
