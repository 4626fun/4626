[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/waitlistPoints

# server/\_lib/waitlistPoints

## Type Aliases

### WaitlistPointSource

> **WaitlistPointSource** = `"waitlist_signup"` \| `"csw_link"` \| `"referral_signup"` \| `"referral_csw_link"` \| `"referral_qualified"` \| `"social_base_app"` \| `"social_zora"` \| `"social_x"` \| `"social_discord"` \| `"social_telegram"` \| `"bonus_github"` \| `"bonus_tiktok"` \| `"bonus_instagram"` \| `"bonus_reddit"` \| `"agent_feedback"` \| `"agent_reputation"` \| `"lens_identity"` \| `"grove_proof"` \| `"task"`

Defined in: [server/\_lib/waitlistPoints.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/waitlistPoints.ts#L38)

## Variables

### WAITLIST\_POINTS

> `const` **WAITLIST\_POINTS**: `object`

Defined in: [server/\_lib/waitlistPoints.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/waitlistPoints.ts#L6)

#### Type Declaration

##### agentFeedback

> `readonly` **agentFeedback**: `1` = `1`

##### agentReputation

> `readonly` **agentReputation**: `8` = `8`

##### baseApp

> `readonly` **baseApp**: `2` = `2`

##### discord

> `readonly` **discord**: `2` = `2`

##### github

> `readonly` **github**: `1` = `1`

##### groveProof

> `readonly` **groveProof**: `2` = `2`

##### instagram

> `readonly` **instagram**: `1` = `1`

##### lensIdentity

> `readonly` **lensIdentity**: `3` = `3`

##### linkCsw

> `readonly` **linkCsw**: `10` = `10`

##### qualifiedReferral

> `readonly` **qualifiedReferral**: `6` = `6`

##### reddit

> `readonly` **reddit**: `1` = `1`

##### referralCswLink

> `readonly` **referralCswLink**: `4` = `4`

##### referralSignup

> `readonly` **referralSignup**: `2` = `2`

##### signup

> `readonly` **signup**: `5` = `5`

##### telegram

> `readonly` **telegram**: `2` = `2`

##### tiktok

> `readonly` **tiktok**: `1` = `1`

##### x

> `readonly` **x**: `2` = `2`

##### zora

> `readonly` **zora**: `2` = `2`

## Functions

### awardWaitlistPoints()

> **awardWaitlistPoints**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/waitlistPoints.ts:148](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/waitlistPoints.ts#L148)

#### Parameters

##### params

###### amount

`number`

###### db

`Db`

###### signupId

`number`

###### source

`string`

###### sourceId?

`string` \| `null`

#### Returns

`Promise`\<`boolean`\>

***

### ensureWaitlistPointsSchema()

> **ensureWaitlistPointsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/waitlistPoints.ts:85](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/waitlistPoints.ts#L85)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### isWaitlistPointSource()

> **isWaitlistPointSource**(`value`): `value is WaitlistPointSource`

Defined in: [server/\_lib/waitlistPoints.ts:81](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/waitlistPoints.ts#L81)

#### Parameters

##### value

`string`

#### Returns

`value is WaitlistPointSource`
