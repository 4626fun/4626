// @vitest-environment happy-dom

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        ({
          children,
          animate: _a,
          exit: _e,
          initial: _i,
          transition: _t,
          viewport: _v,
          whileInView: _w,
          ...props
        }: any) => React.createElement(tag, props, children),
    },
  ),
  useReducedMotion: () => false,
}))

vi.mock('@/lib/zora/client', () => ({
  fetchZoraCoin: vi.fn().mockResolvedValue(null),
  fetchZoraProfile: vi.fn().mockResolvedValue(null),
}))

import { VaultFlowScroll } from './VaultFlowScroll'
import { STORY_CONTENT } from './vault-flow/model/storyContent'

const SHARE_DISTRIBUTION_ROWS = STORY_CONTENT.distribution
const STRATEGY_CARDS = STORY_CONTENT.strategies

function renderVaultFlowScroll() {
  return render(
    <MemoryRouter>
      <VaultFlowScroll depositTokens="50,000,000" shareTokens="50,000,000 ■AKITA" />
    </MemoryRouter>,
  )
}

describe('VaultFlowScroll', () => {
  afterEach(cleanup)

  it('renders the deposit section with vault, counter, and sealed indicator', async () => {
    renderVaultFlowScroll()

    await waitFor(() => {
      expect(screen.getByTestId('token-deposit-scene')).toBeTruthy()
      expect(screen.getByTestId('token-deposit-vault')).toBeTruthy()
      expect(screen.getByTestId('deposited-counter')).toBeTruthy()
      expect(screen.getByTestId('vault-complete-label')).toBeTruthy()
    })
  })

  it('shows total deposited amount in the deposit counter', async () => {
    renderVaultFlowScroll()

    await waitFor(() => {
      const counter = screen.getByTestId('deposited-counter')
      expect(counter.textContent).toMatch(/50,000,000/)
    })
  })

  it('renders distribution section with aria labels and correct order', async () => {
    renderVaultFlowScroll()

    await waitFor(() => {
      const summary = screen.getByLabelText(/distribution summary/i)
      const checkpoint = screen.getByLabelText(/distribution checkpoint progress/i)

      expect(summary).toBeTruthy()
      expect(checkpoint).toBeTruthy()
      expect(summary.textContent?.toLowerCase()).toContain('initial deposit')

      // summary must appear before checkpoint in document order
      expect(
        Boolean(summary.compareDocumentPosition(checkpoint) & Node.DOCUMENT_POSITION_FOLLOWING),
      ).toBe(true)
    })
  })

  it('shows all three distribution route cards with labels and percentages', async () => {
    renderVaultFlowScroll()

    await waitFor(() => {
      for (const row of SHARE_DISTRIBUTION_ROWS) {
        // titles are unique; percentages may repeat (two rows are 40%)
        expect(screen.getByText(row.title)).toBeTruthy()
        expect(screen.getAllByText(row.percent).length).toBeGreaterThan(0)
      }
    })
  })

  it('renders all strategy cards in the deploy section', async () => {
    renderVaultFlowScroll()

    await waitFor(() => {
      for (const s of STRATEGY_CARDS) {
        expect(screen.getByText(s.label)).toBeTruthy()
      }
    })
  })

  it('renders all five step sections', async () => {
    renderVaultFlowScroll()

    await waitFor(() => {
      expect(screen.getByLabelText(/deposit step/i)).toBeTruthy()
      expect(screen.getByLabelText(/mint step/i)).toBeTruthy()
      expect(screen.getByLabelText(/distribute step/i)).toBeTruthy()
      expect(screen.getByLabelText(/deploy step/i)).toBeTruthy()
      expect(screen.getByLabelText(/earn step/i)).toBeTruthy()
    })
  })

  it('does not contain any scrolljacking era text', async () => {
    renderVaultFlowScroll()

    await waitFor(() => {
      expect(screen.queryByText(/Welcome to/)).toBeNull()
      expect(screen.queryByText(/Scroll to descend/i)).toBeNull()
      expect(screen.queryByText(/Deposit complete/)).toBeNull()
    })
  })
})
