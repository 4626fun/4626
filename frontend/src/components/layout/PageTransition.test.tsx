// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PageTransitionSurface, PageTransitionNestedOutlet } from './PageTransition'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion')
  return {
    ...actual,
    useReducedMotion: () => true,
  }
})

describe('PageTransitionSurface', () => {
  it('renders children for the active transition key', () => {
    render(
      <MemoryRouter initialEntries={['/a']}>
        <Routes>
          <Route
            path="/a"
            element={
              <PageTransitionSurface transitionKey="a">
                <div>Page A</div>
              </PageTransitionSurface>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Page A')).toBeTruthy()
  })
})

describe('PageTransitionNestedOutlet', () => {
  it('renders nested route content', () => {
    render(
      <MemoryRouter initialEntries={['/parent/child']}>
        <Routes>
          <Route path="/parent" element={<PageTransitionNestedOutlet />}>
            <Route path="child" element={<div>Nested child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Nested child')).toBeTruthy()
  })
})
