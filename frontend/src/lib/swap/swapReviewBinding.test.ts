import { describe, expect, it } from 'vitest'

import { assertRefreshedSwapPreservesReview } from '@/lib/swap/swapReviewBinding'

describe('assertRefreshedSwapPreservesReview', () => {
  it('accepts refreshed calldata with identical input and no worse output', () => {
    expect(() =>
      assertRefreshedSwapPreservesReview({
        reviewedInputAmount: '100',
        refreshedInputAmount: '100',
        reviewedOutputAmount: '200',
        refreshedOutputAmount: '201',
      }),
    ).not.toThrow()
  })

  it('rejects a silent input downshift after review', () => {
    expect(() =>
      assertRefreshedSwapPreservesReview({
        reviewedInputAmount: '100',
        refreshedInputAmount: '85',
        reviewedOutputAmount: '200',
        refreshedOutputAmount: '200',
      }),
    ).toThrow(/input changed after review/i)
  })

  it('rejects a worse refreshed output after review', () => {
    expect(() =>
      assertRefreshedSwapPreservesReview({
        reviewedInputAmount: '100',
        refreshedInputAmount: '100',
        reviewedOutputAmount: '200',
        refreshedOutputAmount: '199',
      }),
    ).toThrow(/output worsened after review/i)

  })

  it('fails closed when either quote omits economic terms', () => {
    expect(() =>
      assertRefreshedSwapPreservesReview({
        reviewedInputAmount: '100',
        refreshedInputAmount: '100',
        reviewedOutputAmount: '200',
        refreshedOutputAmount: null,
      }),
    ).toThrow(/cannot verify refreshed swap output/i)
  })
})
