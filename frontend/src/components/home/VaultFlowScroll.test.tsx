// @vitest-environment happy-dom

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

type ViewportMode = 'mobile' | 'desktop'

const {
  getMockReducedMotion,
  getMockScrollValue,
  getMockViewportMode,
  setMockReducedMotion,
  setMockScrollValue,
  setMockViewportMode,
} = vi.hoisted(() => {
  let mockScrollValue = 0
  let mockViewportMode: ViewportMode = 'mobile'
  let mockReducedMotion = false

  return {
    getMockReducedMotion: () => mockReducedMotion,
    getMockScrollValue: () => mockScrollValue,
    getMockViewportMode: () => mockViewportMode,
    setMockReducedMotion: (value: boolean) => {
      mockReducedMotion = value
    },
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
    useReducedMotion: () => getMockReducedMotion(),
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
import { STORY_CONTENT } from './vault-flow/model/storyContent'
import { DESKTOP_STAGE4_TIMING, MOBILE_STAGE4_TIMING } from './vault-flow/model/stage4Timings'

const isDocumentOrderedBefore = (a: Node, b: Node) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const SHARE_DISTRIBUTION_ROWS = STORY_CONTENT.distribution
const STRATEGY_CARDS = STORY_CONTENT.strategies

const resolveProgressWithinRange = (
  value: number,
  [start, end]: readonly [number, number],
) => {
  if (value <= start) return 0
  if (value >= end) return 1
  return (value - start) / (end - start)
}

function renderVaultFlowScroll(
  scrollValue: number,
  {
    depositTokens = '50,000,000',
    shareTokens = '50,000,000 ■AKITA',
    reducedMotion = false,
    viewport = 'mobile',
  }: {
    depositTokens?: string
    shareTokens?: string
    reducedMotion?: boolean
    viewport?: ViewportMode
  } = {},
) {
  setMockReducedMotion(reducedMotion)
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
    setMockReducedMotion(false)
    setMockScrollValue(0)
    setMockViewportMode('mobile')
  })

  it('shows the token deposit scene with vault and counter during the deposit beat', async () => {
    // scroll=0.40 → participantDeposits beat, TokenDepositScene is active
    renderVaultFlowScroll(0.40)

    await waitFor(() => {
      expect(screen.getByTestId('token-deposit-scene')).toBeTruthy()
      expect(screen.getByTestId('token-deposit-vault')).toBeTruthy()
      expect(screen.getByTestId('deposited-counter')).toBeTruthy()
    })
  })

  it('reveals vault-sealed indicator once the vault deposit is complete', async () => {
    // scroll=0.40 → participantDeposits beat, atHoldStart → mintConfirmed=true → depositComplete=true
    // The vault-complete-label only mounts when depositComplete=true
    renderVaultFlowScroll(0.40)

    await waitFor(() => {
      expect(screen.getByTestId('vault-complete-label')).toBeTruthy()
    })
  })

  it('shows a distribution checkpoint progress indicator before the stage 3 hard stop', async () => {
    // scroll=0.58 → distributionMeaningful beat, DesktopDistributionHandoffScene active
    renderVaultFlowScroll(0.58)

    await waitFor(() => {
      expect(screen.getByLabelText(/distribution checkpoint progress/i)).toBeTruthy()
    })
  })

  it('keeps the stage 3 summary, checkpoint, and route cards in a readable order', async () => {
    // scroll=0.58 → distributionMeaningful beat
    renderVaultFlowScroll(0.58, {
      depositTokens: '12,345,678',
      shareTokens: '12,345,678 ■AKITA',
      viewport: 'mobile',
    })

    await waitFor(() => {
      const distributionSummary = screen.getByLabelText(/distribution summary/i)
      const distributionCheckpoint = screen.getByLabelText(/distribution checkpoint progress/i)
      const routeCandidates = screen.getAllByText(SHARE_DISTRIBUTION_ROWS[0].title)
      const firstRouteCard =
        routeCandidates.find((node) => isDocumentOrderedBefore(distributionCheckpoint, node))
        ?? routeCandidates[routeCandidates.length - 1]

      expect(distributionSummary).toBeTruthy()
      expect(distributionCheckpoint).toBeTruthy()
      expect(firstRouteCard).toBeTruthy()
      expect(distributionSummary.textContent?.toLowerCase()).toContain('initial deposit')
      expect(isDocumentOrderedBefore(distributionSummary, distributionCheckpoint)).toBe(true)
      expect(isDocumentOrderedBefore(distributionCheckpoint, firstRouteCard)).toBe(true)
    })
  })

  it('renders strategy cards during the deploy stage', async () => {
    // scroll=0.75 → deployStrategies beat (0.66–0.88), DesktopDeployStrategiesScene active
    renderVaultFlowScroll(0.75, {
      depositTokens: '12,345,678',
      shareTokens: '12,345,678 ■AKITA',
      viewport: 'mobile',
    })

    await waitFor(() => {
      expect(screen.getByText(STRATEGY_CARDS[0].label)).toBeTruthy()
    })
  })

  it('stage 4 strategy cards rendered at the same time for desktop and mobile semantic scenes', async () => {
    const deployScroll = 0.75

    renderVaultFlowScroll(deployScroll, {
      depositTokens: '12,345,678',
      shareTokens: '12,345,678 ■AKITA',
      viewport: 'mobile',
    })

    await waitFor(() => {
      expect(screen.getByText(STRATEGY_CARDS[0].label)).toBeTruthy()
    })

    cleanup()

    renderVaultFlowScroll(deployScroll, {
      depositTokens: '12,345,678',
      shareTokens: '12,345,678 ■AKITA',
      viewport: 'desktop',
    })

    await waitFor(() => {
      expect(screen.getByText(STRATEGY_CARDS[0].label)).toBeTruthy()
    })

    // Timing-constant invariant: desktop fanCards[0] still has higher progress than mobile at 0.81
    expect(resolveProgressWithinRange(0.81, DESKTOP_STAGE4_TIMING.fanCards[0].opacity))
      .toBeGreaterThan(resolveProgressWithinRange(0.81, MOBILE_STAGE4_TIMING.fanCards[0].opacity))
  })

  it('hero text is unmounted during distributionMeaningful beat', async () => {
    // scroll=0.55 → well into distributionMeaningful (0.42–0.66); heroOpacity hit 0 at 0.38
    renderVaultFlowScroll(0.55, { viewport: 'desktop' })

    await waitFor(() => {
      expect(screen.queryByText(/Welcome to/)).toBeNull()
    })
  })

  it('deposit card is not mounted during valueFlowsIn beat', async () => {
    // scroll=0.20 → valueFlowsIn (0.14–0.26); depositNodeOpacity is 0 and card not yet needed
    renderVaultFlowScroll(0.20, { viewport: 'desktop' })

    await waitFor(() => {
      // The deposit-card phase labels only appear once the card is mounted
      expect(screen.queryByText(/Deposit complete/)).toBeNull()
      expect(screen.queryByText(/akita ·/)).toBeNull()
    })
  })

  it('renders vault capture markers during contact and containment in normal motion', async () => {
    renderVaultFlowScroll(0.20, { viewport: 'desktop' })

    await waitFor(() => {
      expect(screen.getByTestId('vault-threshold-plane')).toBeTruthy()
      expect(screen.getByTestId('vault-entry-ripple')).toBeTruthy()
      expect(screen.getByTestId('vault-containment-seal')).toBeTruthy()
      expect(screen.getByTestId('vault-contact-flash')).toBeTruthy()
    })
  })

  it('suppresses flash-heavy vault capture effects under reduced motion', async () => {
    renderVaultFlowScroll(0.20, { viewport: 'desktop', reducedMotion: true })

    await waitFor(() => {
      expect(screen.getByTestId('vault-threshold-plane')).toBeTruthy()
      expect(screen.queryByTestId('vault-entry-ripple')).toBeNull()
      expect(screen.queryByTestId('vault-contact-flash')).toBeNull()
      expect(screen.getByTestId('vault-containment-seal')).toBeTruthy()
    })
  })
})
