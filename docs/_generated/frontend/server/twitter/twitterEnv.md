[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/twitter/twitterEnv

# server/twitter/twitterEnv

## Type Aliases

### TwitterOauth1Credentials

> **TwitterOauth1Credentials** = `object`

Defined in: [server/twitter/twitterEnv.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L36)

#### Properties

##### accessSecret

> **accessSecret**: `string`

Defined in: [server/twitter/twitterEnv.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L40)

##### accessToken

> **accessToken**: `string`

Defined in: [server/twitter/twitterEnv.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L39)

##### apiKey

> **apiKey**: `string`

Defined in: [server/twitter/twitterEnv.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L37)

##### apiSecret

> **apiSecret**: `string`

Defined in: [server/twitter/twitterEnv.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L38)

## Functions

### isHermitTwitterStrictModeEnabled()

> **isHermitTwitterStrictModeEnabled**(): `boolean`

Defined in: [server/twitter/twitterEnv.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L29)

#### Returns

`boolean`

***

### missingTwitterOauth1EnvKeys()

> **missingTwitterOauth1EnvKeys**(`creds`, `strictHermitOnly`): `string`[]

Defined in: [server/twitter/twitterEnv.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L64)

#### Parameters

##### creds

[`TwitterOauth1Credentials`](#twitteroauth1credentials)

##### strictHermitOnly

`boolean`

#### Returns

`string`[]

***

### readTwitterBearerToken()

> **readTwitterBearerToken**(): `string` \| `null`

Defined in: [server/twitter/twitterEnv.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L24)

#### Returns

`string` \| `null`

***

### readTwitterOauth1Credentials()

> **readTwitterOauth1Credentials**(`options`): [`TwitterOauth1Credentials`](#twitteroauth1credentials)

Defined in: [server/twitter/twitterEnv.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/twitterEnv.ts#L52)

#### Parameters

##### options

###### strictHermitOnly?

`boolean`

#### Returns

[`TwitterOauth1Credentials`](#twitteroauth1credentials)
