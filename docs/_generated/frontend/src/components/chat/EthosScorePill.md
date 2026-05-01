[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/chat/EthosScorePill

# src/components/chat/EthosScorePill

## Type Aliases

### EthosScorePalette

> **EthosScorePalette** = `object`

Defined in: [src/components/chat/EthosScorePill.tsx:35](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L35)

#### Properties

##### bgClass

> **bgClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:40](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L40)

##### borderClass

> **borderClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:39](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L39)

##### level

> **level**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:36](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L36)

##### ringClass

> **ringClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:41](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L41)

##### strongTextClass

> **strongTextClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:38](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L38)

##### textClass

> **textClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:37](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L37)

***

### EthosScoreValue

> **EthosScoreValue** = `object`

Defined in: [src/components/chat/EthosScorePill.tsx:8](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L8)

#### Properties

##### level

> **level**: `string` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:10](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L10)

##### score

> **score**: `number` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:9](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L9)

## Functions

### EthosAvatarScoreBadge()

> **EthosAvatarScoreBadge**(`__namedParameters`): `Element` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:401](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L401)

#### Parameters

##### \_\_namedParameters

###### className?

`string`

###### level?

`string` \| `null`

###### profileQuery?

`string` \| `null`

###### profileQueryKind?

`"address"` \| `"userkey"` = `'userkey'`

###### score?

`number` \| `null`

#### Returns

`Element` \| `null`

***

### EthosAvatarScoreForAddress()

> **EthosAvatarScoreForAddress**(`__namedParameters`): `Element` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:577](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L577)

#### Parameters

##### \_\_namedParameters

###### address?

`string` \| `null`

###### className?

`string`

#### Returns

`Element` \| `null`

***

### EthosAvatarScoreForUserkey()

> **EthosAvatarScoreForUserkey**(`__namedParameters`): `Element` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:600](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L600)

#### Parameters

##### \_\_namedParameters

###### className?

`string`

###### userkey?

`string` \| `null`

#### Returns

`Element` \| `null`

***

### EthosScoreForAddress()

> **EthosScoreForAddress**(`__namedParameters`): `Element` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:552](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L552)

#### Parameters

##### \_\_namedParameters

###### address?

`string` \| `null`

###### className?

`string`

###### compact?

`boolean` = `true`

#### Returns

`Element` \| `null`

***

### EthosScorePill()

> **EthosScorePill**(`__namedParameters`): `Element` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:370](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L370)

#### Parameters

##### \_\_namedParameters

###### className?

`string`

###### compact?

`boolean` = `false`

###### hideWhenMissing?

`boolean` = `false`

###### level?

`string` \| `null`

###### score?

`number` \| `null`

#### Returns

`Element` \| `null`

***

### fetchEthosScoreForUserkey()

> **fetchEthosScoreForUserkey**(`userkey`): `Promise`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`\>

Defined in: [src/components/chat/EthosScorePill.tsx:288](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L288)

#### Parameters

##### userkey

`string`

#### Returns

`Promise`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`\>

***

### getEthosScorePalette()

> **getEthosScorePalette**(`score`, `level?`): [`EthosScorePalette`](#ethosscorepalette)

Defined in: [src/components/chat/EthosScorePill.tsx:204](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L204)

#### Parameters

##### score

`number` | `null` | `undefined`

##### level?

`string` | `null`

#### Returns

[`EthosScorePalette`](#ethosscorepalette)

***

### useEthosScore()

> **useEthosScore**(`address`): `UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>

Defined in: [src/components/chat/EthosScorePill.tsx:362](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L362)

#### Parameters

##### address

`string` | `null` | `undefined`

#### Returns

`UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>

***

### useEthosScoreForUserkey()

> **useEthosScoreForUserkey**(`userkey`): `UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>

Defined in: [src/components/chat/EthosScorePill.tsx:366](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L366)

#### Parameters

##### userkey

`string` | `null` | `undefined`

#### Returns

`UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>
