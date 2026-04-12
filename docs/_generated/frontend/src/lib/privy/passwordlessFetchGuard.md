[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/passwordlessFetchGuard

# src/lib/privy/passwordlessFetchGuard

## Functions

### getPrivyPasswordlessBackoffMs()

> **getPrivyPasswordlessBackoffMs**(`response`): `number`

Defined in: [src/lib/privy/passwordlessFetchGuard.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/passwordlessFetchGuard.ts#L25)

#### Parameters

##### response

`Response` | \{ `headers?`: `Pick`\<`Headers`, `"get"`\>; \}

#### Returns

`number`

***

### getPrivyPasswordlessFailureBackoffMs()

> **getPrivyPasswordlessFailureBackoffMs**(): `number`

Defined in: [src/lib/privy/passwordlessFetchGuard.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/passwordlessFetchGuard.ts#L61)

#### Returns

`number`

***

### getPrivyPasswordlessInitUrl()

> **getPrivyPasswordlessInitUrl**(): `string`

Defined in: [src/lib/privy/passwordlessFetchGuard.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/passwordlessFetchGuard.ts#L5)

#### Returns

`string`

***

### isPrivyPasswordlessFailure()

> **isPrivyPasswordlessFailure**(`error`): `boolean`

Defined in: [src/lib/privy/passwordlessFetchGuard.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/passwordlessFetchGuard.ts#L42)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isPrivyPasswordlessInitRequest()

> **isPrivyPasswordlessInitRequest**(`url`, `method`): `boolean`

Defined in: [src/lib/privy/passwordlessFetchGuard.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/passwordlessFetchGuard.ts#L16)

#### Parameters

##### url

`string`

##### method

`string`

#### Returns

`boolean`

***

### normalizeFetchMethod()

> **normalizeFetchMethod**(`value`): `string`

Defined in: [src/lib/privy/passwordlessFetchGuard.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/passwordlessFetchGuard.ts#L9)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string`
