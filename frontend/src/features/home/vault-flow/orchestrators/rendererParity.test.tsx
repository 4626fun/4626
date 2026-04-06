// @vitest-environment happy-dom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

import type { StoryState } from '../model/storyClock'

const stateByProfile = vi.hoisted(() => ({
  desktop: null as StoryState | null,
  mobile: null as StoryState | null,
  reduced: null as StoryState | null,
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) => ({ children, ...props }: any) =>
        React.createElement(tag, props, children),
    },
  ),
  useMotionValueEvent: (mv: any, _event: string, cb: (v: number) => void) => {
    React.useEffect(() => {
      if (mv?.get) cb(mv.get())
    }, [mv, cb])
  },
  useScroll: () => ({ scrollYProgress: { get: () => 0.94 } }),
}))

vi.mock('@/features/home/vault-flow/VaultFlowScroll', () => ({
  VaultFlowScroll: () =>
    React.createElement('div', { 'data-testid': 'desktop-scroll' }, 'desktop'),
}))

vi.mock('../model/storyClock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../model/storyClock')>()
  return {
    ...actual,
    deriveStoryState: vi.fn((global: number, profile: 'desktop' | 'mobile' | 'reduced') => {
      const s = stateByProfile[profile]
      if (s) return s
      return actual.deriveStoryState(global, profile)
    }),
  }
})

import { VaultFlowDesktop } from './VaultFlowDesktop'
import { VaultFlowMobile } from './VaultFlowMobile'
import { VaultFlowReduced } from './VaultFlowReduced'
import { STORY_CONTENT } from '../model/storyContent'
import { deriveStoryState } from '../model/storyClock'
import { DesktopEarningTogetherScene } from '../scenes/DesktopEarningTogetherScene'

const baseProps = {
  depositTokens: STORY_CONTENT.defaultDepositTokens,
  shareTokens: `${STORY_CONTENT.defaultDepositTokens} ${STORY_CONTENT.shareTokenSymbol}`,
  content: STORY_CONTENT,
  scrollProgress: { get: () => 0.94 } as any,
}

describe('renderer parity checkpoints', () => {
  it('desktop/mobile/reduced all respect earningTogether loop-active checkpoint', () => {
    const state = deriveStoryState(0.94, 'desktop')
    stateByProfile.desktop = state
    stateByProfile.mobile = state
    stateByProfile.reduced = state

    render(
      <MemoryRouter>
        <VaultFlowDesktop {...baseProps} profile="desktop" />
        <VaultFlowMobile {...baseProps} profile="mobile" />
        <VaultFlowReduced {...baseProps} profile="reduced" />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('desktop-scroll')).toBeTruthy()
    expect(screen.getAllByText(/loop active/i).length).toBeGreaterThanOrEqual(2)
  })

  it('mobile/reduced show re-entry affordance during earningTogether hold window', () => {
    const state = deriveStoryState(0.91, 'desktop')
    stateByProfile.mobile = state
    stateByProfile.reduced = state

    render(
      <MemoryRouter>
        <VaultFlowMobile {...baseProps} profile="mobile" />
        <VaultFlowReduced {...baseProps} profile="reduced" />
      </MemoryRouter>,
    )

    expect(screen.getAllByText(/deposit open/i).length).toBeGreaterThanOrEqual(2)
  })
})

describe('desktop semantic scene parity', () => {
  beforeEach(() => {
    // Reset the profile override map so leaked state from other suites does not
    // contaminate the deriveStoryState mock (which returns stateByProfile[profile]
    // when non-null, regardless of the requested globalProgress).
    stateByProfile.desktop = null
    stateByProfile.mobile = null
    stateByProfile.reduced = null
  })

  it('DesktopEarningTogetherScene renders loop-active chip at earningTogether hold', () => {
    const state = deriveStoryState(0.94, 'desktop')

    render(
      <MemoryRouter>
        <DesktopEarningTogetherScene state={state} content={STORY_CONTENT} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/loop active/i)).toBeTruthy()
  })

  it('DesktopEarningTogetherScene renders deposit-open hint during earningTogether hold window', () => {
    const state = deriveStoryState(0.91, 'desktop')

    render(
      <MemoryRouter>
        <DesktopEarningTogetherScene state={state} content={STORY_CONTENT} />
      </MemoryRouter>,
    )

    expect(screen.getByText(/deposit open/i)).toBeTruthy()
  })

  it('DesktopEarningTogetherScene returns null when earningTogether is not active', () => {
    const state = deriveStoryState(0.5, 'desktop')

    const { container } = render(
      <MemoryRouter>
        <DesktopEarningTogetherScene state={state} content={STORY_CONTENT} />
      </MemoryRouter>,
    )

    expect(container.firstChild).toBeNull()
  })
})
