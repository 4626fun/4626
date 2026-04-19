[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/workspace/api

# src/lib/workspace/api

## Functions

### getWorkspaceActivity()

> **getWorkspaceActivity**(`params`): `Promise`\<[`WorkspaceActivityResponse`](types.md#workspaceactivityresponse)\>

Defined in: [src/lib/workspace/api.ts:60](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/workspace/api.ts#L60)

#### Parameters

##### params

###### includeSystem?

`boolean`

###### limit?

`number`

###### vault

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceActivityResponse`](types.md#workspaceactivityresponse)\>

***

### getWorkspaceMonitoring()

> **getWorkspaceMonitoring**(`vault`): `Promise`\<[`WorkspaceMonitoringResponse`](types.md#workspacemonitoringresponse)\>

Defined in: [src/lib/workspace/api.ts:54](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/workspace/api.ts#L54)

#### Parameters

##### vault

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceMonitoringResponse`](types.md#workspacemonitoringresponse)\>

***

### getWorkspaceRooms()

> **getWorkspaceRooms**(`vault`): `Promise`\<[`WorkspaceRoomsResponse`](types.md#workspaceroomsresponse)\>

Defined in: [src/lib/workspace/api.ts:74](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/workspace/api.ts#L74)

#### Parameters

##### vault

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceRoomsResponse`](types.md#workspaceroomsresponse)\>

***

### getWorkspaceSettings()

> **getWorkspaceSettings**(`vault`): `Promise`\<[`WorkspaceSettingsResponse`](types.md#workspacesettingsresponse)\>

Defined in: [src/lib/workspace/api.ts:94](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/workspace/api.ts#L94)

#### Parameters

##### vault

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceSettingsResponse`](types.md#workspacesettingsresponse)\>

***

### getWorkspaceStrategies()

> **getWorkspaceStrategies**(`vault`): `Promise`\<[`WorkspaceStrategiesResponse`](types.md#workspacestrategiesresponse)\>

Defined in: [src/lib/workspace/api.ts:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/workspace/api.ts#L48)

#### Parameters

##### vault

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceStrategiesResponse`](types.md#workspacestrategiesresponse)\>

***

### getWorkspaceSummary()

> **getWorkspaceSummary**(`vault`): `Promise`\<[`WorkspaceSummary`](types.md#workspacesummary)\>

Defined in: [src/lib/workspace/api.ts:42](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/workspace/api.ts#L42)

#### Parameters

##### vault

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceSummary`](types.md#workspacesummary)\>

***

### getWorkspaceTasks()

> **getWorkspaceTasks**(`params`): `Promise`\<[`WorkspaceTasksResponse`](types.md#workspacetasksresponse)\>

Defined in: [src/lib/workspace/api.ts:80](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/workspace/api.ts#L80)

#### Parameters

##### params

###### approvalStatus?

`string`

###### taskStatus?

`string`

###### vault

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceTasksResponse`](types.md#workspacetasksresponse)\>

***

### postWorkspaceAction()

> **postWorkspaceAction**(`params`): `Promise`\<[`WorkspaceActionResult`](types.md#workspaceactionresult)\>

Defined in: [src/lib/workspace/api.ts:100](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/workspace/api.ts#L100)

#### Parameters

##### params

###### action

`string`

###### payload?

`Record`\<`string`, `unknown`\>

###### vault

`` `0x${string}` ``

#### Returns

`Promise`\<[`WorkspaceActionResult`](types.md#workspaceactionresult)\>
