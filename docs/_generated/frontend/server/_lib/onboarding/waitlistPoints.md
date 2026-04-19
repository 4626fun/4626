[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onboarding/waitlistPoints

# server/\_lib/onboarding/waitlistPoints

## Type Aliases

### WaitlistPointSource

> **WaitlistPointSource** = `"waitlist_signup"` \| `"csw_link"` \| `"referral_signup"` \| `"referral_csw_link"` \| `"referral_qualified"` \| `"referral_passthrough"` \| `"social_base_app"` \| `"social_zora"` \| `"social_x"` \| `"social_discord"` \| `"social_telegram"` \| `"bonus_github"` \| `"bonus_tiktok"` \| `"bonus_instagram"` \| `"bonus_reddit"` \| `"agent_feedback"` \| `"agent_reputation"` \| `"lens_identity"` \| `"grove_proof"` \| `"task"`

Defined in: [server/\_lib/onboarding/waitlistPoints.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPoints.ts#L54)

## Variables

### REFERRAL\_PASSTHROUGH\_FRACTION

> `const` **REFERRAL\_PASSTHROUGH\_FRACTION**: `0.5`

Defined in: [server/\_lib/onboarding/waitlistPoints.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPoints.ts#L110)

Fraction of a referee's earned points that mirrors to the referrer.

***

### WAITLIST\_POINTS

> `const` **WAITLIST\_POINTS**: `object`

Defined in: [server/\_lib/onboarding/waitlistPoints.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPoints.ts#L17)

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

> `readonly` **linkCsw**: `50` = `50`

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

Defined in: [server/\_lib/onboarding/waitlistPoints.ts:202](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPoints.ts#L202)

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

### buildPassthroughSourceKey()

> **buildPassthroughSourceKey**(`refereeSignupId`, `originalSource`, `originalSourceId`): `string`

Defined in: [server/\_lib/onboarding/waitlistPoints.ts:281](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPoints.ts#L281)

Build a collision-safe `source_id` for a passthrough row. If the natural
 composite key fits in the column, use it verbatim. Otherwise keep a
 readable prefix and append a sha256 suffix so two distinct awards can't
 accidentally dedupe to the same row under `ON CONFLICT DO NOTHING`.

#### Parameters

##### refereeSignupId

`number`

##### originalSource

`string`

##### originalSourceId

`string` | `null`

#### Returns

`string`

***

### ensureWaitlistPointsSchema()

> **ensureWaitlistPointsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/onboarding/waitlistPoints.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPoints.ts#L140)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### isWaitlistPointSource()

> **isWaitlistPointSource**(`value`): `value is WaitlistPointSource`

Defined in: [server/\_lib/onboarding/waitlistPoints.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPoints.ts#L136)

#### Parameters

##### value

`string`

#### Returns

`value is WaitlistPointSource`

***

### recordReferralPassthrough()

> **recordReferralPassthrough**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/onboarding/waitlistPoints.ts:326](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/waitlistPoints.ts#L326)

Credit a referrer with 50% of the points a referee just earned.

Reads `profiles.referred_by_signup_id` to find the referrer; writes a
single `referral_passthrough` row whose `source_id` uniquely encodes
the triggering award via `buildPassthroughSourceKey`. Idempotent via
`ON CONFLICT DO NOTHING` on the `points` unique index.

Safety rails (all enforced, not advisory):
  - No-ops when `refereeSignupId` is not a positive integer.
  - No-ops when `amount <= 0` (insert floors to 0 and isn't worth a row).
  - No-ops when `amount > MAX_AWARD_AMOUNT` (treats it as caller bug).
  - No-ops when `originalSource` is a referral-family source
    (`referral_passthrough`, `referral_signup`, etc., enforced by the
    compile-time exhaustive `REFERRAL_FAMILY_EXEMPT` map) — prevents
    pyramids / cascades beyond one hop.
  - No-ops when `referrerId` is not a positive integer, which also
    covers the no-referrer and self-referral edges.
  - Source key is collision-safe: natural composite if it fits, else
    prefix + sha256 suffix. Plain `slice()` is forbidden here because
    two distinct awards could dedupe to the same row.

This is the only code path that writes `referral_passthrough` rows.
The scoring query treats them at weight 1.00× since the halving
already happened here at insert time.

Reciprocal referrals (A refers B, B refers A) are ALLOWED by design:
each direction pays out independently on the other's organic earns,
but never on the other's `referral_passthrough` rows (exempt above),
so there is no compounding. If product wants to block reciprocals,
the hook point is at referral-code claim time, not here.

#### Parameters

##### params

###### amount

`number`

###### db

`Db`

###### originalSource

`string`

###### originalSourceId

`string` \| `null`

###### refereeSignupId

`number`

#### Returns

`Promise`\<`boolean`\>
