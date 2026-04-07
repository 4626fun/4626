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
          style: _s,
          ...props
        }: any) => React.createElement(tag, props, children),
    },
  ),
  useReducedMotion: () => false,
  // useScroll returns a stub MotionValue (no subscribers needed in tests)
  useScroll: () => ({ scrollYProgress: { on: () => () => {} } }),
  // useTransform returns undefined — style props with undefined are ignored by React
  useTransform: () => undefined,
  // useMotionValueEvent is a no-op in tests
  useMotionValueEvent: () => {},
}))

vi.mock('@/lib/zora/client', () => ({
  fetchZoraCoin: vi.fn().mockResolvedValue(null),
  fetchZoraProfile: vi.fn().mockResolvedValue(null),
}))

import { VaultFlowScroll } from '@/features/home/vault-flow/VaultFlowScroll'
import { STORY_CONTENT } from '@/features/home/vault-flow/model/storyContent'

function renderVaultFlowScroll() {
  return render(
    <MemoryRouter>
      <VaultFlowScroll depositTokens="50,000,000" shareTokens="50,000,000 ■AKITA" />
    </MemoryRouter>,
  )
}

describe('VaultFlowScroll', () => {
  afterEach(cleanup)

  it('renders all six narrative beats in the DOM', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      expect(screen.getByTestId('beat-1-threshold')).toBeTruthy()
      expect(screen.getByTestId('beat-2-authority')).toBeTruthy()
      expect(screen.getByTestId('beat-3-commitment')).toBeTruthy()
      expect(screen.getByTestId('beat-4-mint')).toBeTruthy()
      expect(screen.getByTestId('beat-5-structure')).toBeTruthy()
      expect(screen.getByTestId('beat-6-strategies')).toBeTruthy()
    })
  })

  it('beat 1 contains the introducing headline', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      const beat = screen.getByTestId('beat-1-threshold')
      expect(beat.textContent).toMatch(/earn together/i)
    })
  })

  it('beat 2 references the creator token symbol', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      const beat = screen.getByTestId('beat-2-authority')
      // Beat 2 displays the token symbol lowercase for deposit, and share token on the output side.
      expect(beat.textContent).toContain(STORY_CONTENT.creatorTokenSymbol.toLowerCase())
      expect(beat.textContent).toContain(STORY_CONTENT.shareTokenSymbol)
    })
  })

  it('beat 2 renders a vault mint machine with input and output tokens', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      expect(screen.getByTestId('beat-2-vault-machine')).toBeTruthy()
      expect(screen.getByTestId('beat-2-input-token')).toBeTruthy()
      expect(screen.getByTestId('beat-2-output-token')).toBeTruthy()
    })
  })

  it('beat 3 shows the deposit commitment number and lowercase token label', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      const counter = screen.getByTestId('deposited-counter')
      expect(counter.textContent).toContain(STORY_CONTENT.defaultDepositTokens)
      const beat = screen.getByTestId('beat-3-commitment')
      expect(beat.textContent).toContain(STORY_CONTENT.creatorTokenSymbol.toLowerCase())
    })
  })

  it('beat 3 frames the commitment as a deposit bill', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      expect(screen.getByTestId('deposit-bill')).toBeTruthy()
      expect(screen.getByTestId('deposit-slit')).toBeTruthy()
    })
  })

  it('beat 4 shows the minted share token count and symbol', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      const beat = screen.getByTestId('beat-4-mint')
      expect(beat.textContent).toContain(STORY_CONTENT.defaultDepositTokens)
      expect(beat.textContent?.toLowerCase()).toContain('shares minted')
      // The ■AKITA badge is in the shared bridge layer (sibling to beat-4-mint),
      // so query the full document rather than the beat's own subtree.
      expect(screen.getAllByText(STORY_CONTENT.shareTokenSymbol).length).toBeGreaterThan(0)
    })
  })

  it('beat 5 shows all three distribution cards with titles and percentages', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      for (const row of STORY_CONTENT.distribution) {
        expect(screen.getByText(row.title)).toBeTruthy()
        expect(screen.getAllByText(row.percent).length).toBeGreaterThan(0)
      }
    })
  })

  it('beat 5 has distribution aria landmarks', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      expect(screen.getByLabelText(/distribution summary/i)).toBeTruthy()
      expect(screen.getByLabelText(/distribution checkpoint progress/i)).toBeTruthy()
    })
  })

  it('beat 6 shows all four yield strategy rows', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      const beat = screen.getByTestId('beat-6-strategies')
      for (const s of STORY_CONTENT.strategies) {
        expect(beat.textContent).toContain(s.label)
      }
    })
  })

  it('does not contain any scrolljacking-era or static-section text', async () => {
    renderVaultFlowScroll()
    await waitFor(() => {
      expect(screen.queryByText(/Welcome to/)).toBeNull()
      expect(screen.queryByText(/Scroll to descend/i)).toBeNull()
      expect(screen.queryByText(/01 — Deposit/i)).toBeNull()
    })
  })
})
