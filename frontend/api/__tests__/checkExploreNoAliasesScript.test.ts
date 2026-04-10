import path from 'node:path'
import { describe, expect, it } from 'vitest'

// @ts-ignore NodeNext/Bundler typing for local .mjs helper is not resolved in this test project.
import { collectExploreAliasConfigViolationsFromSource, collectExploreAliasQueryFixtureViolationsFromSource } from '../../scripts/check-explore-no-aliases.mjs'

describe('check-explore-no-aliases script helper', () => {
  const explorePagePath = path.join(process.cwd(), 'src/pages/explore/ExploreSample.tsx')
  const exploreTestPath = path.join(process.cwd(), 'src/pages/explore/ExploreSample.test.tsx')

  it('flags Explore alias options in source files', () => {
    const source = `
      useExploreSubnavParams({
        sortValues: ['volume'],
        defaultSort: 'volume',
        sortAliases: { fees24h: 'priceChange' },
      })
    `
    const violations = collectExploreAliasConfigViolationsFromSource(explorePagePath, source)
    expect(violations).toHaveLength(1)
  })

  it('passes source files without alias options', () => {
    const source = `
      useExploreSubnavParams({
        sortValues: ['volume'],
        defaultSort: 'volume',
      })
    `
    const violations = collectExploreAliasConfigViolationsFromSource(explorePagePath, source)
    expect(violations).toEqual([])
  })

  it('flags legacy alias query fixtures in Explore tests', () => {
    const source = `
      const params = new URLSearchParams('sort=fees24h&time=1d')
      expect(params.get('sort')).toBe('fees24h')
    `
    const violations = collectExploreAliasQueryFixtureViolationsFromSource(exploreTestPath, source)
    expect(violations).toHaveLength(1)
  })

  it('passes Explore tests using canonical sort fixtures', () => {
    const source = `
      const params = new URLSearchParams('sort=priceChange&time=1d')
      expect(params.get('sort')).toBe('priceChange')
    `
    const violations = collectExploreAliasQueryFixtureViolationsFromSource(exploreTestPath, source)
    expect(violations).toEqual([])
  })
})
