[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/chat/EthosScorePill

# src/components/chat/EthosScorePill

## Type Aliases

### EthosScorePalette

> **EthosScorePalette** = `object`

Defined in: [src/components/chat/EthosScorePill.tsx:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L35)

#### Properties

##### bgClass

> **bgClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L40)

##### borderClass

> **borderClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L39)

##### level

> **level**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L36)

##### ringClass

> **ringClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L41)

##### strongTextClass

> **strongTextClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L38)

##### textClass

> **textClass**: `string`

Defined in: [src/components/chat/EthosScorePill.tsx:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L37)

***

### EthosScoreValue

> **EthosScoreValue** = `object`

Defined in: [src/components/chat/EthosScorePill.tsx:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L8)

#### Properties

##### level

> **level**: `string` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L10)

##### score

> **score**: `number` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L9)

## Functions

### EthosAvatarScoreBadge()

> **EthosAvatarScoreBadge**(`__namedParameters`): `Element` \| `null`

Defined in: [src/components/chat/EthosScorePill.tsx:446](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L446)

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

Defined in: [src/components/chat/EthosScorePill.tsx:624](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L624)

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

Defined in: [src/components/chat/EthosScorePill.tsx:647](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L647)

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

Defined in: [src/components/chat/EthosScorePill.tsx:599](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L599)

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

Defined in: [src/components/chat/EthosScorePill.tsx:415](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L415)

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

Defined in: [src/components/chat/EthosScorePill.tsx:327](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L327)

#### Parameters

##### userkey

`string`

#### Returns

`Promise`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`\>

***

### getEthosScoreAccentHex()

> **getEthosScoreAccentHex**(`score`, `level?`): `string`

Defined in: [src/components/chat/EthosScorePill.tsx:243](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L243)

#### Parameters

##### score

`number` | `null` | `undefined`

##### level?

`string` | `null`

#### Returns

`string`

***

### getEthosScorePalette()

> **getEthosScorePalette**(`score`, `level?`): [`EthosScorePalette`](#ethosscorepalette)

Defined in: [src/components/chat/EthosScorePill.tsx:238](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L238)

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

Defined in: [src/components/chat/EthosScorePill.tsx:407](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L407)

#### Parameters

##### address

`string` | `null` | `undefined`

#### Returns

`UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>

***

### useEthosScoreForUserkey()

> **useEthosScoreForUserkey**(`userkey`): `UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>

Defined in: [src/components/chat/EthosScorePill.tsx:411](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/EthosScorePill.tsx#L411)

#### Parameters

##### userkey

`string` | `null` | `undefined`

#### Returns

`UseQueryResult`\<[`EthosScoreValue`](#ethosscorevalue) \| `null`, `Error`\>
