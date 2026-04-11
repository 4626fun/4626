[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/accountSetup/shared

# src/features/accountSetup/shared

## Variables

### PROVIDER\_ROWS

> `const` **PROVIDER\_ROWS**: [`ProviderRow`](types.md#providerrow)[]

Defined in: [src/features/accountSetup/shared.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/shared.ts#L3)

## Functions

### deriveOwnerAuthorityState()

> **deriveOwnerAuthorityState**(`input`): [`OwnerAuthorityState`](types.md#ownerauthoritystate)

Defined in: [src/features/accountSetup/shared.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/shared.ts#L39)

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

Defined in: [src/features/accountSetup/shared.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/shared.ts#L25)

#### Parameters

##### data

[`ZoraResolveResponse`](types.md#zoraresolveresponse) | `null` | `undefined`

#### Returns

`boolean`

***

### isMobileWalletEnvironment()

> **isMobileWalletEnvironment**(): `boolean`

Defined in: [src/features/accountSetup/shared.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/shared.ts#L33)

#### Returns

`boolean`

***

### normalizeAddress()

> **normalizeAddress**(`value`): `string` \| `null`

Defined in: [src/features/accountSetup/shared.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/shared.ts#L13)

#### Parameters

##### value

`string`

#### Returns

`string` \| `null`

***

### shortValue()

> **shortValue**(`value`): `string`

Defined in: [src/features/accountSetup/shared.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/shared.ts#L19)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string`

***

### sleep()

> **sleep**(`ms`): `Promise`\<`void`\>

Defined in: [src/features/accountSetup/shared.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/features/accountSetup/shared.ts#L29)

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>
