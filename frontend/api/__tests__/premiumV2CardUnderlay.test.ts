import { describe, expect, it } from 'vitest'

import {
  isOpaqueAvatarCoin,
  resolveV2CardUnderlaySourceClass,
  resolveV2SilhouetteSpillClipRegion,
  shouldSkipV2HeroBackgroundDarken,
} from '../_handlers/token/renderers/premium-v2/cardUnderlay.js'

describe('premiumV2CardUnderlay', () => {
  const jesseLike = {
    lowResolution: true,
    hasTransparency: false,
    sourceClass: 'illustration',
  }

  it('routes Jesse-like opaque avatars to pixelArt stack with extended spill', () => {
    expect(isOpaqueAvatarCoin(jesseLike)).toBe(true)
    expect(resolveV2CardUnderlaySourceClass(jesseLike)).toBe('pixelArt')
    expect(shouldSkipV2HeroBackgroundDarken(jesseLike)).toBe(true)
    expect(resolveV2SilhouetteSpillClipRegion()).toBe('extended')
    expect(
      resolveV2SilhouetteSpillClipRegion({
        hasBreakoutLayer: true,
        heroCutoutBreakout: true,
      }),
    ).toBe('chamber')
  })

  it('keeps generic photo coins on their native stack class', () => {
    const akitaLike = {
      lowResolution: false,
      hasTransparency: false,
      sourceClass: 'generic',
    }
    expect(isOpaqueAvatarCoin(akitaLike)).toBe(false)
    expect(resolveV2CardUnderlaySourceClass(akitaLike)).toBe('generic')
  })
})
