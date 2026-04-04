// @vitest-environment happy-dom

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

type ViewportMode = 'mobile' | 'desktop'

const { getMockScrollValue, getMockViewportMode, setMockScrollValue, setMockViewportMode } = vi.hoisted(() => {
  let mockScrollValue = 0
  let mockViewportMode: ViewportMode = 'mobile'

  return {
    getMockScrollValue: () => mockScrollValue,
    getMockViewportMode: () => mockViewportMode,
    setMockScrollValue: (value: number) => {
      mockScrollValue = value
    },
    setMockViewportMode: (value: ViewportMode) => {
      mockViewportMode = value
    },
  }
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query === '(min-width: 640px)' ? getMockViewportMode() === 'desktop' : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

vi.mock('framer-motion', () => {
  const ignoredStyleKeys = new Set([
    'pathLength',
    'rotate',
    'rotateX',
    'rotateY',
    'rotateZ',
    'scale',
    'scaleX',
    'scaleY',
    'x',
    'y',
  ])

  const motionValue = <T,>(value: T) => ({
    get: () => value,
  })

  const interpolateOutputValue = (from: number | string, to: number | string, progress: number) => {
    if (typeof from === 'number' && typeof to === 'number') {
      return from + (to - from) * progress
    }

    if (typeof from === 'string' && typeof to === 'string') {
      const fromMatch = /^(-?\d*\.?\d+)(.*)$/.exec(from)
      const toMatch = /^(-?\d*\.?\d+)(.*)$/.exec(to)

      if (fromMatch && toMatch && fromMatch[2] === toMatch[2]) {
        const fromValue = Number(fromMatch[1])
        const toValue = Number(toMatch[1])
        return `${fromValue + (toValue - fromValue) * progress}${fromMatch[2]}`
      }
    }

    return progress < 0.5 ? from : to
  }

  const interpolateMotionValue = (
    sourceValue: number,
    input: number[],
    output: Array<number | string>,
  ) => {
    if (input.length === 0 || input.length !== output.length) return output[0] ?? 0
    if (sourceValue <= input[0]) return output[0]

    const lastIdx = input.length - 1
    if (sourceValue >= input[lastIdx]) return output[lastIdx]

    for (let index = 1; index <= lastIdx; index += 1) {
      if (sourceValue <= input[index]) {
        const segmentStart = input[index - 1]
        const segmentEnd = input[index]
        const progress = (sourceValue - segmentStart) / (segmentEnd - segmentStart || 1)
        return interpolateOutputValue(output[index - 1], output[index], progress)
      }
    }

    return output[lastIdx]
  }

  const resolveMotionValue = (value: unknown) =>
    value && typeof value === 'object' && 'get' in value && typeof (value as { get: unknown }).get === 'function'
      ? (value as { get: () => unknown }).get()
      : value

  const resolveStyle = (style: Record<string, unknown> | undefined) => {
    if (!style) return undefined

    return Object.fromEntries(
      Object.entries(style)
        .filter(([key]) => !ignoredStyleKeys.has(key))
        .map(([key, value]) => [key, resolveMotionValue(value)]),
    )
  }

  const useTransform = (
    source: unknown,
    inputOrTransformer?: unknown,
    _output?: unknown,
  ) => {
    if (typeof inputOrTransformer === 'function') {
      const sourceValue = Array.isArray(source)
        ? source.map((value) => resolveMotionValue(value))
        : resolveMotionValue(source)

      return motionValue(inputOrTransformer(sourceValue))
    }

    if (Array.isArray(inputOrTransformer) && Array.isArray(_output)) {
      const sourceValue = Number(resolveMotionValue(source) ?? 0)
      return motionValue(interpolateMotionValue(sourceValue, inputOrTransformer as number[], _output as Array<number | string>))
    }

    return motionValue(0)
  }

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy(
      {},
      {
        get: (_, tag: string) =>
          ({
            children,
            animate: _animate,
            exit: _exit,
            initial: _initial,
            transition: _transition,
            viewport: _viewport,
            whileHover: _whileHover,
            whileInView: _whileInView,
            ...props
          }: any) => React.createElement(tag, { ...props, style: resolveStyle(props.style) }, children),
      },
    ),
    useMotionTemplate: () => '',
    useMotionValueEvent: (
      value: { get?: () => number } | undefined,
      _event: string,
      callback: (latest: number) => void,
    ) => {
      React.useEffect(() => {
        if (value?.get) callback(value.get())
      }, [value, callback])
    },
    useReducedMotion: () => false,
    useScroll: () => ({ scrollYProgress: motionValue(getMockScrollValue()) }),
    useSpring: <T,>(value: T) => value,
    useTransform,
  }
})

vi.mock('@/lib/zora/client', () => ({
  fetchZoraCoin: vi.fn().mockResolvedValue(null),
  fetchZoraProfile: vi.fn().mockResolvedValue(null),
}))

import { VaultFlowScroll } from './VaultFlowScroll'
import { SHARE_DISTRIBUTION_ROWS, STRATEGY_CARDS } from './launchConfig'
import { DESKTOP_STAGE4_TIMING, MOBILE_STAGE4_TIMING } from './vaultFlowStageTimings'

const isDocumentOrderedBefore = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const resolveProgressWithinRange = (
  value: number,
  [start, end]: readonly [number, number],
) => {
  if (value <= start) return 0
  if (value >= end) return 1
  return (value - start) / (end - start)
}

const getStrategyCardOpacity = (label: string) => {
  const cardLabel = screen.getByText(label)
  const cardFrame = cardLabel.closest('div[style]')

  if (!cardFrame?.parentElement) {
    throw new Error(`Could not find strategy card wrapper for "${label}"`)
  }

  return Number.parseFloat(cardFrame.parentElement.style.opacity || '0')
}

function renderVaultFlowScroll(
  scrollValue: number,
  {
    depositTokens = '50,000,000',
    shareTokens = '50,000,000 ■AKITA',
    viewport = 'mobile',
  }: {
    depositTokens?: string
    shareTokens?: string
    viewport?: ViewportMode
  } = {},
) {
  setMockViewportMode(viewport)
  setMockScrollValue(scrollValue)

  return render(
    <MemoryRouter>
      <VaultFlowScroll depositTokens={depositTokens} shareTokens={shareTokens} />
    </MemoryRouter>,
  )
}

describe('VaultFlowScroll', () => {
  afterEach(() => {
    cleanup()
    setMockScrollValue(0)
    setMockViewportMode('mobile')
  })

  it('uses the provided deposit amount in the stage 2 confirmation card', async () => {
    renderVaultFlowScroll(0.48, { depositTokens: '12,345,678', shareTokens: '12,345,678 ■AKITA' })

    await waitFor(() => {
      expect(screen.getAllByText('12,345,678').length).toBeGreaterThanOrEqual(2)
    })
  })

  it('renders separate akita deposit and ■AKITA mint columns at the stage 2 confirmation checkpoint', async () => {
    renderVaultFlowScroll(0.48)

    await waitFor(() => {
      expect(screen.getByText(/akita deposit/i)).toBeTruthy()
      expect(screen.getAllByText(/■AKITA minted/i).length).toBeGreaterThan(0)
      expect(screen.getAllByAltText('■AKITA share token').length).toBeGreaterThan(0)
    })
  })

  it('shows a distribution checkpoint progress indicator before the stage 3 hard stop', async () => {
    renderVaultFlowScroll(0.69)

    await waitFor(() => {
      expect(screen.getByLabelText(/distribution checkpoint progress/i)).toBeTruthy()
    })
  })

  it('keeps the mobile stage 3 summary, checkpoint, and route cards in a readable order', async () => {
    renderVaultFlowScroll(0.69, {
      depositTokens: '12,345,678',
      shareTokens: '12,345,678 ■AKITA',
      viewport: 'mobile',
    })

    await waitFor(() => {
      const distributionSummary = screen.getByLabelText(/distribution summary/i)
      const distributionCheckpoint = screen.getByLabelText(/distribution checkpoint progress/i)
      const firstRouteCard = screen.getByText(SHARE_DISTRIBUTION_ROWS[0].title)

      expect(distributionSummary).toBeTruthy()
      expect(distributionCheckpoint).toBeTruthy()
      expect(firstRouteCard).toBeTruthy()
      expect(distributionSummary.textContent?.toLowerCase()).toContain('live routing')
      expect(isDocumentOrderedBefore(distributionSummary, distributionCheckpoint)).toBe(true)
      expect(isDocumentOrderedBefore(distributionCheckpoint, firstRouteCard)).toBe(true)
    })
  })

  it('renders the mobile deploy summary unchanged in stage 4', async () => {
    renderVaultFlowScroll(0.88, {
      depositTokens: '12,345,678',
      shareTokens: '12,345,678 ■AKITA',
      viewport: 'mobile',
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/deploy summary/i)).toBeTruthy()
      const deploySummary = screen.getByLabelText(/deploy summary/i)
      expect(deploySummary.textContent).toContain('12,345,678')
      expect(deploySummary.textContent?.toLowerCase()).toContain('4 yield strategies live')
    })
  })

  it('reveals the first desktop stage 4 strategy card earlier than mobile at the same scroll value', async () => {
    const comparisonScroll = 0.81

    renderVaultFlowScroll(comparisonScroll, {
      depositTokens: '12,345,678',
      shareTokens: '12,345,678 ■AKITA',
      viewport: 'mobile',
    })

    const mobileFirstCardOpacity = await waitFor(() => {
      const opacity = getStrategyCardOpacity(STRATEGY_CARDS[0].label)
      expect(opacity).toBeGreaterThan(0)
      return opacity
    })

    cleanup()

    renderVaultFlowScroll(comparisonScroll, {
      depositTokens: '12,345,678',
      shareTokens: '12,345,678 ■AKITA',
      viewport: 'desktop',
    })

    const desktopFirstCardOpacity = await waitFor(() => {
      const opacity = getStrategyCardOpacity(STRATEGY_CARDS[0].label)
      expect(opacity).toBeGreaterThan(mobileFirstCardOpacity)
      return opacity
    })

    expect(desktopFirstCardOpacity).toBeGreaterThan(mobileFirstCardOpacity)
    expect(resolveProgressWithinRange(comparisonScroll, DESKTOP_STAGE4_TIMING.fanCards[0].opacity))
      .toBeGreaterThan(resolveProgressWithinRange(comparisonScroll, MOBILE_STAGE4_TIMING.fanCards[0].opacity))
  })
})
