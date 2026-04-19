[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useVaultGaugeVoting

# src/hooks/useVaultGaugeVoting

## Interfaces

### EpochInfo

Defined in: [src/hooks/useVaultGaugeVoting.ts:51](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L51)

#### Properties

##### currentEpoch

> **currentEpoch**: `number`

Defined in: [src/hooks/useVaultGaugeVoting.ts:52](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L52)

##### epochDuration

> **epochDuration**: `number`

Defined in: [src/hooks/useVaultGaugeVoting.ts:56](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L56)

##### epochEndTime

> **epochEndTime**: `Date`

Defined in: [src/hooks/useVaultGaugeVoting.ts:54](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L54)

##### epochStartTime

> **epochStartTime**: `Date`

Defined in: [src/hooks/useVaultGaugeVoting.ts:53](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L53)

##### timeRemaining

> **timeRemaining**: `number`

Defined in: [src/hooks/useVaultGaugeVoting.ts:55](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L55)

***

### VaultVote

Defined in: [src/hooks/useVaultGaugeVoting.ts:45](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L45)

#### Properties

##### vault

> **vault**: `string`

Defined in: [src/hooks/useVaultGaugeVoting.ts:46](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L46)

##### weight

> **weight**: `bigint`

Defined in: [src/hooks/useVaultGaugeVoting.ts:47](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L47)

##### weightBps

> **weightBps**: `number`

Defined in: [src/hooks/useVaultGaugeVoting.ts:48](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L48)

***

### VotingPowerInfo

Defined in: [src/hooks/useVaultGaugeVoting.ts:59](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L59)

#### Properties

##### hasActiveLock

> **hasActiveLock**: `boolean`

Defined in: [src/hooks/useVaultGaugeVoting.ts:62](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L62)

##### remainingLockTime

> **remainingLockTime**: `number`

Defined in: [src/hooks/useVaultGaugeVoting.ts:63](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L63)

##### totalPower

> **totalPower**: `bigint`

Defined in: [src/hooks/useVaultGaugeVoting.ts:61](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L61)

##### userPower

> **userPower**: `bigint`

Defined in: [src/hooks/useVaultGaugeVoting.ts:60](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L60)

## Functions

### formatVotingPower()

> **formatVotingPower**(`power`, `decimals`): `string`

Defined in: [src/hooks/useVaultGaugeVoting.ts:318](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L318)

#### Parameters

##### power

`bigint`

##### decimals

`number` = `18`

#### Returns

`string`

***

### useTimeRemaining()

> **useTimeRemaining**(`seconds`): `string`

Defined in: [src/hooks/useVaultGaugeVoting.ts:299](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L299)

#### Parameters

##### seconds

`number`

#### Returns

`string`

***

### useVaultGaugeVoting()

> **useVaultGaugeVoting**(`__namedParameters`): `object`

Defined in: [src/hooks/useVaultGaugeVoting.ts:71](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useVaultGaugeVoting.ts#L71)

#### Parameters

##### \_\_namedParameters

`UseVaultGaugeVotingProps`

#### Returns

`object`

##### epochInfo

> **epochInfo**: [`EpochInfo`](#epochinfo) \| `undefined`

##### hasVotedThisEpoch

> **hasVotedThisEpoch**: `boolean` \| `undefined`

##### isVoting

> **isVoting**: `boolean`

##### pendingTxHash

> **pendingTxHash**: `` `0x${string}` `` \| `undefined`

##### refetchAll()

> **refetchAll**: () => `void`

###### Returns

`void`

##### resetVotes()

> **resetVotes**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### totalWeight

> **totalWeight**: `bigint` \| `undefined`

##### txSuccess

> **txSuccess**: `boolean`

##### userVotes

> **userVotes**: [`VaultVote`](#vaultvote)[]

##### vote()

> **vote**: (`vaults`, `weights`) => `Promise`\<`void`\>

###### Parameters

###### vaults

`string`[]

###### weights

`number`[]

###### Returns

`Promise`\<`void`\>

##### votingPowerInfo

> **votingPowerInfo**: [`VotingPowerInfo`](#votingpowerinfo) \| `undefined`

##### whitelistedVaults

> **whitelistedVaults**: `string`[] \| `undefined`
