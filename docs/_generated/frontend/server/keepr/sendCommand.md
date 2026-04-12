[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/keepr/sendCommand

# server/keepr/sendCommand

## Functions

### handleSendCommand()

> **handleSendCommand**(`params`): `Promise`\<[`KeeprCommandResult`](../commands/types.md#keeprcommandresult)\>

Defined in: [server/keepr/sendCommand.ts:227](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/keepr/sendCommand.ts#L227)

#### Parameters

##### params

###### groupId

`string`

###### role

[`KeeprRole`](../commands/types.md#keeprrole)

###### senderWallet

`` `0x${string}` ``

###### text

`string`

###### vault

[`KeeprVaultRow`](../_lib/keeprRegistry.md#keeprvaultrow)

#### Returns

`Promise`\<[`KeeprCommandResult`](../commands/types.md#keeprcommandresult)\>
