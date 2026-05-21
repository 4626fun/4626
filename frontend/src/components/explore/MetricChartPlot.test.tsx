import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { MetricChartPlot } from './MetricChartPlot'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
  LineChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'line-chart' }, children),
  BarChart: ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'bar-chart' }, children),
  Line: () => React.createElement('div', { 'data-testid': 'line' }),
  Bar: () => React.createElement('div', { 'data-testid': 'bar' }),
  Cell: () => null,
  Tooltip: () => null,
  YAxis: () => null,
}))

const baseProps = {
  values: [1, 3, 2, 5],
  yDomain: { min: 0, max: 10 },
  primaryColor: '#3b82f6',
  secondaryColor: '#22c55e',
} as const

describe('MetricChartPlot', () => {
  it('renders line chart without error', () => {
    const html = renderToStaticMarkup(
      React.createElement(MetricChartPlot, { ...baseProps, mode: 'line' }),
    )
    expect(html).toContain('data-testid="line-chart"')
    expect(html).toContain('data-testid="line"')
  })

  it('renders bar chart without error', () => {
    const html = renderToStaticMarkup(
      React.createElement(MetricChartPlot, { ...baseProps, mode: 'bar' }),
    )
    expect(html).toContain('data-testid="bar-chart"')
  })

  it('renders stacked bar chart with token shares', () => {
    const html = renderToStaticMarkup(
      React.createElement(MetricChartPlot, {
        ...baseProps,
        mode: 'stacked-bar',
        token0Share: 0.6,
        token1Share: 0.4,
      }),
    )
    expect(html).toContain('data-testid="bar-chart"')
  })
})
