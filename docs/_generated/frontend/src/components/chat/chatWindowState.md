[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/chat/chatWindowState

# src/components/chat/chatWindowState

## Functions

### resolveCommandCenterVisibility()

> **resolveCommandCenterVisibility**(`params`): `boolean`

Defined in: [src/components/chat/chatWindowState.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/chatWindowState.ts#L20)

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

Defined in: [src/components/chat/chatWindowState.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/chat/chatWindowState.ts#L7)

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
