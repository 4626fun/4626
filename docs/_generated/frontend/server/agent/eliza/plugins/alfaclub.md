[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / server/agent/eliza/plugins/alfaclub

# server/agent/eliza/plugins/alfaclub

## Variables

### alfaclubPlugin

> `const` **alfaclubPlugin**: `Plugin`

Defined in: [server/agent/eliza/plugins/alfaclub/index.ts:422](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/plugins/alfaclub/index.ts#L422)

## Functions

### formatCreatorDetail()

> **formatCreatorDetail**(`params`): `string`

Defined in: [server/agent/eliza/plugins/alfaclub/index.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/plugins/alfaclub/index.ts#L176)

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

Defined in: [server/agent/eliza/plugins/alfaclub/index.ts:259](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/plugins/alfaclub/index.ts#L259)

#### Returns

`string`

***

### formatLeaderboard()

> **formatLeaderboard**(`params`): `string`

Defined in: [server/agent/eliza/plugins/alfaclub/index.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/plugins/alfaclub/index.ts#L121)

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

Defined in: [server/agent/eliza/plugins/alfaclub/index.ts:243](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/plugins/alfaclub/index.ts#L243)

#### Parameters

##### flags

[`VigilanteFlags`](../../../_lib/alfaclub/vigilante.md#vigilanteflags)

#### Returns

`string`

***

### parseSubcommand()

> **parseSubcommand**(`text`): `object`

Defined in: [server/agent/eliza/plugins/alfaclub/index.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/plugins/alfaclub/index.ts#L77)

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
