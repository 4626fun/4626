import { describe, expect, it } from 'vitest'

import { __testables } from '../_handlers/token/_image.ts'

describe('token image renderer', () => {
  it('renders a single inner frame without an outer frame', () => {
    const svg = __testables.generateFramedSvg({
      size: 1024,
      symbol: 'AKITA',
      creatorCoinImage: 'data:image/png;base64,ZmFrZQ==',
    })

    expect(svg).toContain("data-frame='inner'")
    expect(svg).not.toContain("data-frame='outer'")
  })

  it('uses the real token artwork inside the branded icon composition', () => {
    const href = 'data:image/png;base64,ZmFrZQ=='
    const svg = __testables.generateFramedSvg({
      size: 1024,
      symbol: 'AKITA',
      creatorCoinImage: href,
    })

    expect(svg).toContain(href)
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"')
  })

  it('renders an opaque canvas matte behind the rounded icon', () => {
    const svg = __testables.generateFramedSvg({
      size: 512,
      symbol: 'AKITA',
      creatorCoinImage: 'data:image/png;base64,ZmFrZQ==',
    })

    expect(svg).toContain('<rect width="512" height="512" fill="#000000" />')
  })

  it('allocates a larger artwork footprint for the crop-first layout', () => {
    const layout = __testables.getTokenIconLayout(1024)

    expect(layout.artSize).toBeGreaterThan(780)
  })

  it('biases moderately portrait artwork toward cover cropping', () => {
    expect(__testables.chooseArtworkFitMode(768, 1024)).toBe('cover')
  })

  it('classifies transparent token art as contain', () => {
    expect(
      __testables.classifyTokenImageMetrics({
        aspectRatio: 1,
        hasTransparency: true,
        alphaCoverage: 0.42,
        edgeOccupancy: 0.18,
        circularBadgeLikelihood: 0.12,
        opaquePhotoLikelihood: 0.18,
      }),
    ).toMatchObject({
      layoutMode: 'contain',
      allowBreakout: false,
    })
  })

  it('classifies circular badge icons as coin mode', () => {
    expect(
      __testables.classifyTokenImageMetrics({
        aspectRatio: 1,
        hasTransparency: true,
        alphaCoverage: 0.58,
        edgeOccupancy: 0.08,
        circularBadgeLikelihood: 0.92,
        opaquePhotoLikelihood: 0.08,
      }),
    ).toMatchObject({
      layoutMode: 'coin',
      allowBreakout: false,
    })
  })

  it('classifies opaque rectangular artwork as cover mode', () => {
    expect(
      __testables.classifyTokenImageMetrics({
        aspectRatio: 1.18,
        hasTransparency: false,
        alphaCoverage: 1,
        edgeOccupancy: 0.88,
        circularBadgeLikelihood: 0.06,
        opaquePhotoLikelihood: 0.94,
      }),
    ).toMatchObject({
      layoutMode: 'cover',
      allowBreakout: true,
    })
  })

  it('disables breakout for coin recipes', () => {
    const recipe = __testables.deriveTokenIconRecipe(
      {
        layoutMode: 'coin',
        allowBreakout: false,
      },
      {
        size: 1024,
        hasUsableBreakoutMask: true,
        breakoutCoverage: 0.42,
      },
    )

    expect(recipe.mode).toBe('coin')
    expect(recipe.breakout).toBe(false)
  })

  it('disables breakout when mask quality is poor', () => {
    const recipe = __testables.deriveTokenIconRecipe(
      {
        layoutMode: 'cover',
        allowBreakout: true,
      },
      {
        size: 1024,
        hasUsableBreakoutMask: false,
        breakoutCoverage: 0.04,
      },
    )

    expect(recipe.mode).toBe('cover')
    expect(recipe.breakout).toBe(false)
  })

  it('uses a larger immersive scale for cover recipes', () => {
    const recipe = __testables.deriveTokenIconRecipe(
      {
        layoutMode: 'cover',
        allowBreakout: true,
      },
      {
        size: 1024,
        hasUsableBreakoutMask: false,
        breakoutCoverage: 0.04,
      },
    )

    expect(recipe.scale).toBeGreaterThanOrEqual(1.0)
  })

  it('enables breakout for strong cover candidates', () => {
    const recipe = __testables.deriveTokenIconRecipe(
      {
        layoutMode: 'cover',
        allowBreakout: true,
      },
      {
        size: 1024,
        hasUsableBreakoutMask: true,
        breakoutCoverage: 0.12,
      },
    )

    expect(recipe.breakout).toBe(true)
  })

  it('builds multi-recipe candidates for cover images with contain fallback', () => {
    const recipes = __testables.buildCandidateRecipes({
      classification: {
        layoutMode: 'cover',
        allowBreakout: true,
      },
      breakoutEvaluation: {
        size: 1024,
        hasUsableBreakoutMask: true,
        breakoutCoverage: 0.12,
      },
      metrics: {
        aspectRatio: 1,
        hasTransparency: false,
        alphaCoverage: 1,
        edgeOccupancy: 0.88,
        circularBadgeLikelihood: 0.18,
        opaquePhotoLikelihood: 0.92,
        topOccupancy: 0.2,
      },
    })

    expect(recipes.length).toBeGreaterThanOrEqual(3)
    expect(recipes.some((candidate) => candidate.mode === 'contain')).toBe(true)
    expect(recipes.some((candidate) => candidate.mode === 'cover' && candidate.breakout)).toBe(true)
  })

  it('keeps coin-first candidate ordering for coin classifications', () => {
    const recipes = __testables.buildCandidateRecipes({
      classification: {
        layoutMode: 'coin',
        allowBreakout: false,
      },
      breakoutEvaluation: {
        size: 1024,
        hasUsableBreakoutMask: false,
        breakoutCoverage: 0.02,
      },
      metrics: {
        aspectRatio: 1,
        hasTransparency: true,
        alphaCoverage: 0.6,
        edgeOccupancy: 0.12,
        circularBadgeLikelihood: 0.93,
        opaquePhotoLikelihood: 0.2,
        topOccupancy: 0.04,
      },
    })

    expect(recipes[0]?.mode).toBe('coin')
    expect(recipes.every((candidate) => candidate.breakout === false)).toBe(true)
  })
})
