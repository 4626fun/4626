[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/chat/EthosScorePill

# src/components/chat/EthosScorePill

## Type Aliases

### EthosScoreValue

> **EthosScoreValue** = `object`

Defined in: [src/components/chat/EthosScorePill.tsx:7](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L7)

#### Properties

##### level

> **level**: `string` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:9](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L9)

##### score

> **score**: `number` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:8](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L8)

## Functions

### EthosAvatarScoreBadge()

> **EthosAvatarScoreBadge**(`__namedParameters`): `Element` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:287](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L287)

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

Defined in: [src/components/chat/EthosScorePill.tsx:421](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L421)

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

Defined in: [src/components/chat/EthosScorePill.tsx:444](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L444)

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

Defined in: [src/components/chat/EthosScorePill.tsx:396](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L396)

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

Defined in: [src/components/chat/EthosScorePill.tsx:256](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L256)

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

Defined in: [src/components/chat/EthosScorePill.tsx:174](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L174)

#### Parameters

##### userkey

`string`

#### Returns

`Promise`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`\>

***

### useEthosScore()

> **useEthosScore**(`address`): `UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>

Defined in: [src/components/chat/EthosScorePill.tsx:248](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L248)

#### Parameters

##### address

`string` | `null` | `undefined`

#### Returns

`UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>

***

### useEthosScoreForUserkey()

> **useEthosScoreForUserkey**(`userkey`): `UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>

Defined in: [src/components/chat/EthosScorePill.tsx:252](https://github.com/wenakita/4626/blob/main/frontend/src/components/chat/EthosScorePill.tsx#L252)

#### Parameters

##### userkey

`string` | `null` | `undefined`

#### Returns

`UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>
