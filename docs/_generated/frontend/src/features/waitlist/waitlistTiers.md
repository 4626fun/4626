[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistTiers

# src/features/waitlist/waitlistTiers

## Type Aliases

### WaitlistProgress

> **WaitlistProgress** = `object`

Defined in: [src/features/waitlist/waitlistTiers.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L70)

#### Properties

##### currentTier

> **currentTier**: [`WaitlistTier`](#waitlisttier)

Defined in: [src/features/waitlist/waitlistTiers.ts:71](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L71)

##### nextTier

> **nextTier**: [`WaitlistTier`](#waitlisttier) \| `null`

Defined in: [src/features/waitlist/waitlistTiers.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L72)

##### points

> **points**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:73](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L73)

##### pointsToNext

> **pointsToNext**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L74)

##### progressPercent

> **progressPercent**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L75)

***

### WaitlistTier

> **WaitlistTier** = `object`

Defined in: [src/features/waitlist/waitlistTiers.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L15)

#### Properties

##### highlights

> **highlights**: `string`[]

Defined in: [src/features/waitlist/waitlistTiers.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L20)

##### id

> **id**: [`WaitlistTierId`](#waitlisttierid-1)

Defined in: [src/features/waitlist/waitlistTiers.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L16)

##### name

> **name**: `string`

Defined in: [src/features/waitlist/waitlistTiers.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L17)

##### pointsRequired

> **pointsRequired**: `number`

Defined in: [src/features/waitlist/waitlistTiers.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L19)

##### tagline

> **tagline**: `string`

Defined in: [src/features/waitlist/waitlistTiers.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L18)

***

### WaitlistTierId

> **WaitlistTierId** = `0` \| `1` \| `2` \| `3`

Defined in: [src/features/waitlist/waitlistTiers.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L13)

Waitlist tier ladder — authoritative thresholds for point-based progression.

Mirrors the server-side `toScoreTier` in
`frontend/server/_lib/identity/accountsIdentity.ts` so the UI stays in sync
with the tier returned by `/api/waitlist/bootstrap` and `/api/accounts/me`.
Tier thresholds use canonical **waitlist points** (leaderboard score), not AMOE credits.

Copy intentionally avoids promising product perks that aren't in place. Each
tier is phrased as a progression signal rather than an unlock claim.

## Variables

### PROVIDER\_POINTS

> `const` **PROVIDER\_POINTS**: `Record`\<`string`, `number`\>

Defined in: [src/features/waitlist/waitlistTiers.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L121)

Per-provider point rewards. Mirrors server `LINK_POINTS` exactly so the
row-level "+N" badges shown next to each provider in the waitlist
Advanced section match the server state machine. Zora is authoritative
via its own step 1; the rest are secondary identity links.

All values are even integers by convention so that referral passthrough
(`floor(amount × 0.5)`) is exact — see `LINK_POINTS` on the server.

***

### WAITLIST\_TIERS

> `const` **WAITLIST\_TIERS**: readonly [`WaitlistTier`](#waitlisttier)[]

Defined in: [src/features/waitlist/waitlistTiers.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L23)

## Functions

### computeProgress()

> **computeProgress**(`points`): [`WaitlistProgress`](#waitlistprogress)

Defined in: [src/features/waitlist/waitlistTiers.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L83)

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

Defined in: [src/features/waitlist/waitlistTiers.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L64)

Return the tier record for a given id (always defined).

#### Parameters

##### id

[`WaitlistTierId`](#waitlisttierid-1)

#### Returns

[`WaitlistTier`](#waitlisttier)

***

### tierFromPoints()

> **tierFromPoints**(`points`): [`WaitlistTierId`](#waitlisttierid-1)

Defined in: [src/features/waitlist/waitlistTiers.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistTiers.ts#L55)

Derive the tier a point total falls into. Mirrors server `toScoreTier`.

#### Parameters

##### points

`number`

#### Returns

[`WaitlistTierId`](#waitlisttierid-1)
