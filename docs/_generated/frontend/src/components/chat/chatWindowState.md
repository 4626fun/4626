[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/chat/chatWindowState

# src/components/chat/chatWindowState

## Functions

### resolveCommandCenterVisibility()

> **resolveCommandCenterVisibility**(`params`): `boolean`

Defined in: [src/components/chat/chatWindowState.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/components/chat/chatWindowState.ts#L20)

#### Parameters

##### params

###### desktopCommandsOpen

`boolean`

###### isMobile

`boolean`

###### showCommandCenter

`boolean`

#### Returns

`boolean`

***

### shouldAttemptInactiveDmRecovery()

> **shouldAttemptInactiveDmRecovery**(`params`): `boolean`

Defined in: [src/components/chat/chatWindowState.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/components/chat/chatWindowState.ts#L7)

#### Parameters

##### params

###### conversationType

`ConversationType`

###### dmPeerAddress

`string` \| `null`

###### dmPeerInboxId

`string` \| `null`

###### reason

`string`

#### Returns

`boolean`
