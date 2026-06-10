import { describe, expect, it } from 'vitest'

import {
  leaderboardAccountKindLabel,
  resolveLeaderboardAccountKind,
  resolveLeaderboardWalletProvider,
} from './leaderboardAccountKind'

describe('leaderboardAccountKind', () => {
  it('prefers base app over zora and csw', () => {
    expect(
      resolveLeaderboardAccountKind({
        showBaseAppBadge: true,
        showZoraBadge: true,
        cswAddress: '0xabc',
      }),
    ).toBe('base_app')
  })

  it('prefers zora over plain csw', () => {
    expect(
      resolveLeaderboardAccountKind({
        showZoraBadge: true,
        cswAddress: '0xabc',
      }),
    ).toBe('zora')
  })

  it('uses coinbase csw when only canonical csw is known', () => {
    expect(
      resolveLeaderboardAccountKind({
        cswAddress: '0xabc',
      }),
    ).toBe('coinbase_csw')
  })

  it('uses eoa lane with provider hint when no csw', () => {
    expect(
      resolveLeaderboardAccountKind({
        walletProvider: 'rabby',
      }),
    ).toBe('eoa')
    expect(resolveLeaderboardWalletProvider('rabby')).toBe('rabby')
    expect(leaderboardAccountKindLabel('eoa', 'rabby')).toBe('Rabby')
  })
})
