[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/keepr/sendCommand

# server/keepr/sendCommand

## Functions

### handleSendCommand()

> **handleSendCommand**(`params`): `Promise`\<[`KeeprCommandResult`](../commands/types.md#keeprcommandresult)\>

Defined in: [server/keepr/sendCommand.ts:242](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/keepr/sendCommand.ts#L242)

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

[`KeeprVaultRow`](../_lib/keepr/keeprRegistry.md#keeprvaultrow)

#### Returns

`Promise`\<[`KeeprCommandResult`](../commands/types.md#keeprcommandresult)\>
