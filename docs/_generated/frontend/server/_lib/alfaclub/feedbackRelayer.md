[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/feedbackRelayer

# server/\_lib/alfaclub/feedbackRelayer

## Type Aliases

### RelayerFlags

> **RelayerFlags** = `object`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L93)

#### Properties

##### dryRun

> **dryRun**: `boolean`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L96)

##### intervalMs

> **intervalMs**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L97)

##### killSwitch

> **killSwitch**: `boolean`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L94)

##### maxAttempts

> **maxAttempts**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L100)

##### maxPerTick

> **maxPerTick**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L98)

##### relayerEnabled

> **relayerEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L95)

##### spacingMs

> **spacingMs**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L99)

***

### RelayerSkipReason

> **RelayerSkipReason** = `"kill_switch"` \| `"disabled"` \| `"privy_env_missing"` \| `"owner_context_failed"` \| `"no_queued_rows"`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:163](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L163)

***

### RelayerTickResult

> **RelayerTickResult** = `object`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:170](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L170)

#### Properties

##### abandoned

> **abandoned**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:174](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L174)

##### dryRun

> **dryRun**: `boolean`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:178](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L178)

##### durationMs

> **durationMs**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:181](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L181)

##### errors

> **errors**: `object`[]

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:177](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L177)

###### error

> **error**: `string`

###### publicationKey

> **publicationKey**: `string`

##### failed

> **failed**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:173](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L173)

##### ownerAddress

> **ownerAddress**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:179](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L179)

##### ownerIndex

> **ownerIndex**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:180](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L180)

##### picked

> **picked**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:171](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L171)

##### skipped

> **skipped**: [`RelayerSkipReason`](#relayerskipreason) \| `null`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:175](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L175)

##### submitted

> **submitted**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L172)

##### txHashes

> **txHashes**: `string`[]

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L176)

***

### StartRelayerResult

> **StartRelayerResult** = `object`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:420](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L420)

#### Properties

##### intervalMs

> **intervalMs**: `number`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:423](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L423)

##### reason?

> `optional` **reason**: [`RelayerSkipReason`](#relayerskipreason) \| `"already_running"`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:422](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L422)

##### started

> **started**: `boolean`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:421](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L421)

##### stop()

> **stop**: () => `void`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:424](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L424)

###### Returns

`void`

***

### SubmitCallFn()

> **SubmitCallFn** = (`params`) => `Promise`\<\{ `ok`: `true`; `txHash`: `string`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:184](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L184)

#### Parameters

##### params

###### bundlerUrl

`string`

###### calls

[`CoinbaseSmartWalletCall`](../wallet/privyCoinbaseSmartWallet.md#coinbasesmartwalletcall)[]

###### ownerAddress

`Address`

###### ownerIndex

`number`

###### smartWallet

`Address`

###### walletId

`string`

#### Returns

`Promise`\<\{ `ok`: `true`; `txHash`: `string`; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

## Variables

### GIVE\_FEEDBACK\_FUNCTION\_SELECTOR

> `const` **GIVE\_FEEDBACK\_FUNCTION\_SELECTOR**: `` `0x${string}` `` = `GIVE_FEEDBACK_SELECTOR`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:496](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L496)

## Functions

### \_resetAlfaClubRelayerStateForTests()

> **\_resetAlfaClubRelayerStateForTests**(): `void`

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:489](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L489)

Reset internal state for tests only.

#### Returns

`void`

***

### isGiveFeedbackCalldata()

> **isGiveFeedbackCalldata**(`value`): `` value is `0x${string}` ``

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:201](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L201)

Strict check: must be 0x-prefixed hex, length >= 10 (selector + at least
one byte of args), and the first 4 bytes must match `giveFeedback`.

#### Parameters

##### value

`string` | `null`

#### Returns

`` value is `0x${string}` ``

***

### readRelayerFlags()

> **readRelayerFlags**(): [`RelayerFlags`](#relayerflags)

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L103)

#### Returns

[`RelayerFlags`](#relayerflags)

***

### relayAlfaClubFeedbackOnce()

> **relayAlfaClubFeedbackOnce**(`opts`): `Promise`\<[`RelayerTickResult`](#relayertickresult)\>

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:266](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L266)

#### Parameters

##### opts

###### dryRun?

`boolean`

###### flags?

[`RelayerFlags`](#relayerflags)

###### listQueued?

(`limit`) => `Promise`\<[`PublicationRecord`](publicationLedger.md#publicationrecord)[]\>

###### maxPerTick?

`number`

###### resolveOwnerContext?

() => `Promise`\<\{ `ownerAddress`: `` `0x${string}` ``; `ownerIndex`: `number`; \}\>

###### submitCall?

[`SubmitCallFn`](#submitcallfn)

#### Returns

`Promise`\<[`RelayerTickResult`](#relayertickresult)\>

***

### startAlfaClubFeedbackRelayer()

> **startAlfaClubFeedbackRelayer**(`opts?`): [`StartRelayerResult`](#startrelayerresult)

Defined in: [server/\_lib/alfaclub/feedbackRelayer.ts:433](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/feedbackRelayer.ts#L433)

Start the long-lived relayer loop. Idempotent: if already running,
returns the same `stop()` closure without starting a second interval.
The returned `stop()` cancels the interval and waits for any in-flight
tick.

#### Parameters

##### opts?

###### onError?

(`err`) => `void`

###### onTick?

(`result`) => `void`

#### Returns

[`StartRelayerResult`](#startrelayerresult)

## References

### REPUTATION\_REGISTRY\_ABI

Re-exports [REPUTATION_REGISTRY_ABI](../agent/erc8004.md#reputation_registry_abi)
