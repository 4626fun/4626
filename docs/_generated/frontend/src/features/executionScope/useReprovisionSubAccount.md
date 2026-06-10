[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/executionScope/useReprovisionSubAccount

# src/features/executionScope/useReprovisionSubAccount

## Type Aliases

### ReprovisionResult

> **ReprovisionResult** = \{ `ok`: `true`; `parentCswAddress`: `Address`; `permissionHash`: `Hex`; `subAccountAddress`: `Address`; \} \| \{ `code`: `string`; `message`: `string`; `ok`: `false`; \}

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L52)

***

### UseReprovisionReturn

> **UseReprovisionReturn** = `object`

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L65)

#### Properties

##### busy

> **busy**: `boolean`

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L66)

##### error

> **error**: `string` \| `null`

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L68)

##### phase

> **phase**: `"idle"` \| `"delegating"` \| `"preparing"` \| `"signing"` \| `"committing"` \| `"done"` \| `"error"`

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L67)

##### reprovision()

> **reprovision**: (`caps?`) => `Promise`\<[`ReprovisionResult`](#reprovisionresult)\>

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L69)

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

Defined in: [src/features/executionScope/useReprovisionSubAccount.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/useReprovisionSubAccount.ts#L72)

#### Returns

[`UseReprovisionReturn`](#usereprovisionreturn)
