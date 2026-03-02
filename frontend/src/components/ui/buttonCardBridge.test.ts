import { describe, expect, it } from 'vitest'

import { Button as UiButton } from './Button'
import { Card as UiCard } from './Card'
import { Button as PackageButton, Card as PackageCard } from '@4626/brand-kit/components'

describe('ui bridge to brand-kit primitives', () => {
  it('re-exports package Button and Card from ui layer', () => {
    expect(UiButton).toBe(PackageButton)
    expect(UiCard).toBe(PackageCard)
  })
})
