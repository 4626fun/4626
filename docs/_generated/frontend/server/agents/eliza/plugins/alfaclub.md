[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / server/agents/eliza/plugins/alfaclub

# server/agents/eliza/plugins/alfaclub

## Variables

### alfaclubPlugin

> `const` **alfaclubPlugin**: `Plugin`

Defined in: [server/agents/eliza/plugins/alfaclub/index.ts:426](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/plugins/alfaclub/index.ts#L426)

## Functions

### formatCreatorDetail()

> **formatCreatorDetail**(`params`): `string`

Defined in: [server/agents/eliza/plugins/alfaclub/index.ts:180](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/plugins/alfaclub/index.ts#L180)

#### Parameters

##### params

###### address

`string`

###### flags

[`VigilanteFlags`](../../../_lib/alfaclub/vigilante.md#vigilanteflags)

###### publications

[`PublicationRecord`](../../../_lib/alfaclub/publicationLedger.md#publicationrecord)[]

###### row

[`MetricsSnapshotRow`](../../../_lib/alfaclub/publicationLedger.md#metricssnapshotrow) \| `null`

###### snapshotTs

`string` \| `null`

#### Returns

`string`

***

### formatHelp()

> **formatHelp**(): `string`

Defined in: [server/agents/eliza/plugins/alfaclub/index.ts:263](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/plugins/alfaclub/index.ts#L263)

#### Returns

`string`

***

### formatLeaderboard()

> **formatLeaderboard**(`params`): `string`

Defined in: [server/agents/eliza/plugins/alfaclub/index.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/plugins/alfaclub/index.ts#L125)

#### Parameters

##### params

###### flags

[`VigilanteFlags`](../../../_lib/alfaclub/vigilante.md#vigilanteflags)

###### pubsByAddress

`Map`\<`string`, [`PublicationRecord`](../../../_lib/alfaclub/publicationLedger.md#publicationrecord)[]\>

###### rows

[`MetricsSnapshotRow`](../../../_lib/alfaclub/publicationLedger.md#metricssnapshotrow)[]

###### snapshotTs

`string` \| `null`

#### Returns

`string`

***

### formatStatus()

> **formatStatus**(`flags`): `string`

Defined in: [server/agents/eliza/plugins/alfaclub/index.ts:247](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/plugins/alfaclub/index.ts#L247)

#### Parameters

##### flags

[`VigilanteFlags`](../../../_lib/alfaclub/vigilante.md#vigilanteflags)

#### Returns

`string`

***

### parseSubcommand()

> **parseSubcommand**(`text`): `object`

Defined in: [server/agents/eliza/plugins/alfaclub/index.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/agents/eliza/plugins/alfaclub/index.ts#L77)

#### Parameters

##### text

`string`

#### Returns

`object`

##### address

> **address**: `string` \| `null`

##### sub

> **sub**: `"creator"` \| `"status"` \| `"help"` \| `"leaderboard"` \| `null`

## References

### default

Renames and re-exports [alfaclubPlugin](#alfaclubplugin)
