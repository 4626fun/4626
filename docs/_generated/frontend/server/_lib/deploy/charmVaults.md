[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/deploy/charmVaults

# server/\_lib/deploy/charmVaults

## Functions

### charmPoolNotIndexedError()

> **charmPoolNotIndexedError**(`poolAddress`): `string`

Defined in: [server/\_lib/deploy/charmVaults.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L160)

#### Parameters

##### poolAddress

`string`

#### Returns

`string`

***

### createBasePublicClientForCharmValidation()

> **createBasePublicClientForCharmValidation**(): `object`

Defined in: [server/\_lib/deploy/charmVaults.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L67)

#### Returns

`object`

***

### extractCharmCreateVaultPool()

> **extractCharmCreateVaultPool**(`call`): `string` \| `null`

Defined in: [server/\_lib/deploy/charmVaults.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L95)

#### Parameters

##### call

###### data?

`string`

###### to?

`string`

#### Returns

`string` \| `null`

***

### getCharmFactoryAddress()

> **getCharmFactoryAddress**(): `string`

Defined in: [server/\_lib/deploy/charmVaults.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L51)

#### Returns

`string`

***

### getCharmStitchingBaseEndpoint()

> **getCharmStitchingBaseEndpoint**(): `string`

Defined in: [server/\_lib/deploy/charmVaults.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L62)

#### Returns

`string`

***

### getCharmValidationRpcUrl()

> **getCharmValidationRpcUrl**(): `string`

Defined in: [server/\_lib/deploy/charmVaults.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L57)

#### Returns

`string`

***

### isCharmPoolIndexed()

> **isCharmPoolIndexed**(`params`): `Promise`\<`boolean` \| `null`\>

Defined in: [server/\_lib/deploy/charmVaults.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L116)

#### Parameters

##### params

###### endpoint?

`string`

###### fetchImpl?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

###### poolAddress

`string`

#### Returns

`Promise`\<`boolean` \| `null`\>

***

### isOfficialCharmVault()

> **isOfficialCharmVault**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/deploy/charmVaults.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L74)

#### Parameters

##### params

###### charmVaultAddress

`string`

###### publicClient?

\{ `readContract`: (`request`) => `Promise`\<`unknown`\>; \}

###### publicClient.readContract

(`request`) => `Promise`\<`unknown`\>

#### Returns

`Promise`\<`boolean`\>

***

### officialCharmVaultError()

> **officialCharmVaultError**(`charmVaultAddress`): `string`

Defined in: [server/\_lib/deploy/charmVaults.ts:156](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/charmVaults.ts#L156)

#### Parameters

##### charmVaultAddress

`string`

#### Returns

`string`
