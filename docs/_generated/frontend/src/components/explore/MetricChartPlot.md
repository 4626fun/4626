[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/MetricChartPlot

# src/components/explore/MetricChartPlot

## Type Aliases

### MetricChartPlotMode

> **MetricChartPlotMode** = `"line"` \| `"bar"` \| `"stacked-bar"`

Defined in: [src/components/explore/MetricChartPlot.tsx:13](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L13)

***

### MetricChartPlotProps

> **MetricChartPlotProps** = `object`

Defined in: [src/components/explore/MetricChartPlot.tsx:22](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L22)

#### Properties

##### mode

> **mode**: [`MetricChartPlotMode`](#metricchartplotmode)

Defined in: [src/components/explore/MetricChartPlot.tsx:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L23)

##### onScrub()?

> `optional` **onScrub**: (`index`) => `void`

Defined in: [src/components/explore/MetricChartPlot.tsx:30](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L30)

###### Parameters

###### index

`number` | `undefined`

###### Returns

`void`

##### primaryColor

> **primaryColor**: `string`

Defined in: [src/components/explore/MetricChartPlot.tsx:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L26)

##### secondaryColor

> **secondaryColor**: `string`

Defined in: [src/components/explore/MetricChartPlot.tsx:27](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L27)

##### token0Share?

> `optional` **token0Share**: `number` \| `null`

Defined in: [src/components/explore/MetricChartPlot.tsx:28](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L28)

##### token1Share?

> `optional` **token1Share**: `number` \| `null`

Defined in: [src/components/explore/MetricChartPlot.tsx:29](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L29)

##### values

> **values**: `number`[]

Defined in: [src/components/explore/MetricChartPlot.tsx:24](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L24)

##### yDomain

> **yDomain**: `object`

Defined in: [src/components/explore/MetricChartPlot.tsx:25](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L25)

###### max

> **max**: `number`

###### min

> **min**: `number`

## Functions

### MetricChartPlot()

> **MetricChartPlot**(`__namedParameters`): `Element`

Defined in: [src/components/explore/MetricChartPlot.tsx:47](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/MetricChartPlot.tsx#L47)

#### Parameters

##### \_\_namedParameters

[`MetricChartPlotProps`](#metricchartplotprops)

#### Returns

`Element`
