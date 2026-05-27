[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/exploreSparklineHydrate

# server/\_lib/zora/exploreSparklineHydrate

## Variables

### DEFAULT\_EXPLORE\_SPARKLINE\_HYDRATE\_CONCURRENCY

> `const` **DEFAULT\_EXPLORE\_SPARKLINE\_HYDRATE\_CONCURRENCY**: `8` = `8`

Defined in: [server/\_lib/zora/exploreSparklineHydrate.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklineHydrate.ts#L9)

***

### DEFAULT\_EXPLORE\_SPARKLINE\_HYDRATE\_MAX

> `const` **DEFAULT\_EXPLORE\_SPARKLINE\_HYDRATE\_MAX**: `48` = `48`

Defined in: [server/\_lib/zora/exploreSparklineHydrate.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklineHydrate.ts#L8)

## Functions

### hydrateExploreSparklinesOnEdges()

> **hydrateExploreSparklinesOnEdges**(`db`, `edges`, `options`): `Promise`\<\{ `attempted`: `number`; `hydrated`: `number`; \}\>

Defined in: [server/\_lib/zora/exploreSparklineHydrate.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklineHydrate.ts#L41)

Resolve subgraph-first sparklines for visible explore rows missing cached trend30d.
Keeps the client on a single /api/zora/explore round-trip for first paint.

#### Parameters

##### db

[`DbPool`](../db/postgres.md#dbpool)

##### edges

readonly `ExploreEdge`[]

##### options

###### concurrency?

`number`

###### maxResolve?

`number`

###### sdk?

`unknown`

#### Returns

`Promise`\<\{ `attempted`: `number`; `hydrated`: `number`; \}\>
