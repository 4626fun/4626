[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/twitter/verifyTweet

# server/twitter/verifyTweet

## Type Aliases

### VerifiedTweet

> **VerifiedTweet** = `object`

Defined in: [server/twitter/verifyTweet.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/verifyTweet.ts#L4)

#### Properties

##### authorId

> **authorId**: `string` \| `null`

Defined in: [server/twitter/verifyTweet.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/verifyTweet.ts#L8)

##### authorUsername

> **authorUsername**: `string` \| `null`

Defined in: [server/twitter/verifyTweet.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/verifyTweet.ts#L9)

##### canonicalUrl

> **canonicalUrl**: `string`

Defined in: [server/twitter/verifyTweet.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/verifyTweet.ts#L6)

##### text

> **text**: `string`

Defined in: [server/twitter/verifyTweet.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/verifyTweet.ts#L7)

##### tweetId

> **tweetId**: `string`

Defined in: [server/twitter/verifyTweet.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/verifyTweet.ts#L5)

## Functions

### extractTweetIdFromInput()

> **extractTweetIdFromInput**(`params`): `string` \| `null`

Defined in: [server/twitter/verifyTweet.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/verifyTweet.ts#L12)

#### Parameters

##### params

###### tweetId?

`string` \| `null`

###### tweetUrl?

`string` \| `null`

#### Returns

`string` \| `null`

***

### verifyTweetForAmoe()

> **verifyTweetForAmoe**(`params`): `Promise`\<[`VerifiedTweet`](#verifiedtweet)\>

Defined in: [server/twitter/verifyTweet.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/verifyTweet.ts#L50)

#### Parameters

##### params

###### linkedTwitterUserIds

`string`[]

###### linkedTwitterUsernames

`string`[]

###### tweetId

`string`

#### Returns

`Promise`\<[`VerifiedTweet`](#verifiedtweet)\>
