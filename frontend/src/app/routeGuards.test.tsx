// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockAppOrigin = 'https://v1.4626.fun'
let mockMarketingOrigin = 'https://4626.fun'
let mockHostMode: 'app' | 'marketing' = 'app'

vi.mock('@/lib/host', async () => {
  const actual = await vi.importActual<typeof import('@/lib/host')>('@/lib/host')
  return {
    ...actual,
    get APP_ORIGIN() {
      return mockAppOrigin
    },
    get MARKETING_ORIGIN() {
      return mockMarketingOrigin
    },
    getHostMode: () => mockHostMode,
  }
})

import { HostGuard } from './routeGuards'

describe('HostGuard', () => {
  beforeEach(() => {
    mockAppOrigin = 'https://v1.4626.fun'
    mockMarketingOrigin = 'https://4626.fun'
    mockHostMode = 'app'
    window.history.replaceState({}, '', 'http://localhost:3000/')
  })

  it('does not redirect when the computed app target is already the current url', async () => {
    mockHostMode = 'marketing'
    mockAppOrigin = 'http://localhost:3000'
    window.history.replaceState({}, '', 'http://localhost:3000/swap')
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/swap']}>
        <Routes>
          <Route
            path="/swap"
            element={
              <>
                <HostGuard />
                <div data-testid="swap-content">swap</div>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('swap-content')).toBeTruthy()
    expect(replaceSpy).not.toHaveBeenCalled()
    replaceSpy.mockRestore()
  })
})
