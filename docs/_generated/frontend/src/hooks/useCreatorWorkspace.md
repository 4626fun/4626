[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useCreatorWorkspace

# src/hooks/useCreatorWorkspace

## Functions

### useCreatorWorkspace()

> **useCreatorWorkspace**(`options`): `object`

Defined in: [src/hooks/useCreatorWorkspace.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useCreatorWorkspace.ts#L25)

#### Parameters

##### options

`UseCreatorWorkspaceOptions`

#### Returns

`object`

##### actionMutation

> **actionMutation**: `UseMutationResult`\<[`WorkspaceActionResult`](../lib/workspace/types.md#workspaceactionresult), `Error`, \{ `action`: `string`; `payload?`: `Record`\<`string`, `unknown`\>; \}, `unknown`\>

##### activity

> **activity**: `UseQueryResult`\<[`WorkspaceActivityResponse`](../lib/workspace/types.md#workspaceactivityresponse), `Error`\>

##### isAnyLoading

> **isAnyLoading**: `boolean`

##### monitoring

> **monitoring**: `UseQueryResult`\<[`WorkspaceMonitoringResponse`](../lib/workspace/types.md#workspacemonitoringresponse), `Error`\>

##### rooms

> **rooms**: `UseQueryResult`\<[`WorkspaceRoomsResponse`](../lib/workspace/types.md#workspaceroomsresponse), `Error`\>

##### settings

> **settings**: `UseQueryResult`\<[`WorkspaceSettingsResponse`](../lib/workspace/types.md#workspacesettingsresponse), `Error`\>

##### strategies

> **strategies**: `UseQueryResult`\<[`WorkspaceStrategiesResponse`](../lib/workspace/types.md#workspacestrategiesresponse), `Error`\>

##### summary

> **summary**: `UseQueryResult`\<[`WorkspaceSummary`](../lib/workspace/types.md#workspacesummary), `Error`\>

##### tasks

> **tasks**: `UseQueryResult`\<[`WorkspaceTasksResponse`](../lib/workspace/types.md#workspacetasksresponse), `Error`\>
