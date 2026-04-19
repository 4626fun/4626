[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/waitlistTiers

# src/features/waitlist/waitlistTiers

## Type Aliases

### PointSuggestion

> **PointSuggestion** = `object`

Defined in: [src/features/waitlist/waitlistTiers.ts:120](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L120)

Curated "how to earn more points" suggestions based on `WAITLIST_POINTS` on
the server. Kept in sync by mirror rather than import because
`server/_lib/*` is not importable from `src/` (frontend boundary rule).

When `to` is set, the suggestion renders as an internal link; when unset,
it renders as static text (useful for passive actions like "a referral
completes their profile" which the user can't directly trigger).

#### Properties

##### hint?

> `optional` **hint**: `string`

Defined in: [src/features/waitlist/waitlistTiers.ts:123](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L123)

##### label

> **label**: `string`

Defined in: [src/features/waitlist/waitlistTiers.ts:121](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L121)

##### points

> **points**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:122](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L122)

##### to?

> `optional` **to**: `string`

Defined in: [src/features/waitlist/waitlistTiers.ts:128](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L128)

Optional in-app route that will help the user complete this action.
Kept as a simple path so the tiers module stays UI-framework-agnostic.

***

### WaitlistProgress

> **WaitlistProgress** = `object`

Defined in: [src/features/waitlist/waitlistTiers.ts:69](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L69)

#### Properties

##### currentTier

> **currentTier**: [`WaitlistTier`](#waitlisttier)

Defined in: [src/features/waitlist/waitlistTiers.ts:70](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L70)

##### nextTier

> **nextTier**: [`WaitlistTier`](#waitlisttier) \| `null`

Defined in: [src/features/waitlist/waitlistTiers.ts:71](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L71)

##### points

> **points**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:72](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L72)

##### pointsToNext

> **pointsToNext**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:73](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L73)

##### progressPercent

> **progressPercent**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:74](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L74)

***

### WaitlistTier

> **WaitlistTier** = `object`

Defined in: [src/features/waitlist/waitlistTiers.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L14)

#### Properties

##### highlights

> **highlights**: `string`[]

Defined in: [src/features/waitlist/waitlistTiers.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L19)

##### id

> **id**: [`WaitlistTierId`](#waitlisttierid-1)

Defined in: [src/features/waitlist/waitlistTiers.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L15)

##### name

> **name**: `string`

Defined in: [src/features/waitlist/waitlistTiers.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L16)

##### pointsRequired

> **pointsRequired**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L18)

##### tagline

> **tagline**: `string`

Defined in: [src/features/waitlist/waitlistTiers.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L17)

***

### WaitlistTierId

> **WaitlistTierId** = `0` \| `1` \| `2` \| `3`

Defined in: [src/features/waitlist/waitlistTiers.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L12)

Waitlist tier ladder — authoritative thresholds for point-based progression.

Mirrors the server-side `toScoreTier` in
`frontend/server/_lib/identity/accountsIdentity.ts` so the UI stays in sync
with the tier returned by `/onboarding/bootstrap`.

Copy intentionally avoids promising product perks that aren't in place. Each
tier is phrased as a progression signal rather than an unlock claim.

## Variables

### AMOE\_POINTS

> `const` **AMOE\_POINTS**: `object`

Defined in: [src/features/waitlist/waitlistTiers.ts:169](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L169)

AMOE daily-share event reward. Mirrors `AMOE_CHECKIN_POINTS` in
`frontend/server/_lib/lottery/amoeWaitlistPoints.ts`. Surfaced so the
AMOE card / portfolio can render a "+N points" hint without guessing
the server value.

Note: lottery entry submissions intentionally don't award waitlist
points — the daily social share is the base earn action; entries
depend on credits earned from that share.

#### Type Declaration

##### checkin

> `readonly` **checkin**: `6` = `6`

Points awarded per successful daily share (X / Farcaster / Telegram).

***

### POINT\_SUGGESTIONS

> `const` **POINT\_SUGGESTIONS**: readonly [`PointSuggestion`](#pointsuggestion)[]

Defined in: [src/features/waitlist/waitlistTiers.ts:141](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L141)

Mirrors server `LINK_POINTS` + event-point values in
`frontend/server/_lib/identity/accountsIdentity.ts`. Keep this list
deduplicated on the canonical actions: link Zora gives the biggest
single jump; detecting a creator coin is automatic and not actionable,
so it isn't surfaced here.

Ordered highest-impact first so the UI's top 2-3 suggestions move the
user the furthest in a single session.

***

### PROVIDER\_POINTS

> `const` **PROVIDER\_POINTS**: `Record`\<`string`, `number`\>

Defined in: [src/features/waitlist/waitlistTiers.ts:183](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L183)

Per-provider point rewards. Mirrors server `LINK_POINTS` exactly so the
row-level "+N" badges shown next to each provider in the waitlist
Advanced section match the server state machine. Zora is authoritative
via its own step 1; the rest are secondary identity links.

All values are even integers by convention so that referral passthrough
(`floor(amount × 0.5)`) is exact — see `LINK_POINTS` on the server.

***

### WAITLIST\_TIERS

> `const` **WAITLIST\_TIERS**: readonly [`WaitlistTier`](#waitlisttier)[]

Defined in: [src/features/waitlist/waitlistTiers.ts:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L22)

## Functions

### computeProgress()

> **computeProgress**(`points`): [`WaitlistProgress`](#waitlistprogress)

Defined in: [src/features/waitlist/waitlistTiers.ts:82](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L82)

Given a point total, return structured progress data for UI rendering.
`progressPercent` is clamped to 0..100 and represents distance from the
previous tier threshold toward the next.

#### Parameters

##### points

`number`

#### Returns

[`WaitlistProgress`](#waitlistprogress)

***

### getTier()

> **getTier**(`id`): [`WaitlistTier`](#waitlisttier)

Defined in: [src/features/waitlist/waitlistTiers.ts:63](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L63)

Return the tier record for a given id (always defined).

#### Parameters

##### id

[`WaitlistTierId`](#waitlisttierid-1)

#### Returns

[`WaitlistTier`](#waitlisttier)

***

### tierFromPoints()

> **tierFromPoints**(`points`): [`WaitlistTierId`](#waitlisttierid-1)

Defined in: [src/features/waitlist/waitlistTiers.ts:54](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/waitlist/waitlistTiers.ts#L54)

Derive the tier a point total falls into. Mirrors server `toScoreTier`.

#### Parameters

##### points

`number`

#### Returns

[`WaitlistTierId`](#waitlisttierid-1)
