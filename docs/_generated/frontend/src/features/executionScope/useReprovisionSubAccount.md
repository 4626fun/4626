[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/executionScope/useReprovisionSubAccount

# src/features/executionScope/useReprovisionSubAccount

## Type Aliases

### ReprovisionResult

> **ReprovisionResult** = \{ `ok`: `true`; `parentCswAddress`: `Address`; `permissionHash`: `Hex`; `subAccountAddress`: `Address`; \} \| \{ `code`: `string`; `message`: `string`; `ok`: `false`; \}

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L51)

***

### UseReprovisionReturn

> **UseReprovisionReturn** = `object`

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L64)

#### Properties

##### busy

> **busy**: `boolean`

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L65)

##### error

> **error**: `string` \| `null`

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L67)

##### phase

> **phase**: `"idle"` \| `"preparing"` \| `"signing"` \| `"committing"` \| `"done"` \| `"error"`

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L66)

##### reprovision()

> **reprovision**: (`caps?`) => `Promise`\<[`ReprovisionResult`](#reprovisionresult)\>

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L68)

###### Parameters

###### caps?

###### dailyCapWei?

`string`

###### perTxCapWei?

`string`

###### Returns

`Promise`\<[`ReprovisionResult`](#reprovisionresult)\>

## Functions

### useReprovisionSubAccount()

> **useReprovisionSubAccount**(): [`UseReprovisionReturn`](#usereprovisionreturn)

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L71)

#### Returns

[`UseReprovisionReturn`](#usereprovisionreturn)
