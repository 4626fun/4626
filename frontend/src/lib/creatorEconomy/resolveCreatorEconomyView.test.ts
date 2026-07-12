import { describe, expect, it } from 'vitest'

import {
  createCreatorEconomyCapabilitiesFixture,
  resolveCreatorEconomyView,
} from './resolveCreatorEconomyView'

const COIN = '0x1111111111111111111111111111111111111111' as const
const VAULT = '0x2222222222222222222222222222222222222222' as const
const ARM = '0x3333333333333333333333333333333333333333' as const

describe('resolveCreatorEconomyView', () => {
  it('returns no-economy CTA when there is no creator coin', () => {
    const view = resolveCreatorEconomyView(createCreatorEconomyCapabilitiesFixture())
    expect(view.role).toBe('none')
    expect(view.statusLabel).toBe('No creator economy yet')
    expect(view.primaryAction).toEqual({
      label: 'Launch or link coin',
      href: '/deploy/coin',
    })
    expect(view.showPaywall).toBe(false)
    expect(view.preferEconomyTab).toBe(false)
  })

  it('maps coin without vault to continue-launch CTA', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        ownsCreatorEconomy: true,
        symbol: 'AKITA',
        creatorCoinAddress: COIN,
        bundleStatus: 'unlocked',
      }),
    )
    expect(view.role).toBe('prelaunch_creator')
    expect(view.statusLabel).toBe('Creator coin ready for a vault')
    expect(view.primaryAction).toEqual({
      label: 'Continue launch',
      href: '/deploy/vault',
    })
    expect(view.showPaywall).toBe(false)
    expect(view.symbolDisplay).toBe('$AKITA')
    expect(view.preferEconomyTab).toBe(true)
  })

  it('requires unlock deployment when greenfield bundle is missing', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        ownsCreatorEconomy: true,
        symbol: 'NEW',
        creatorCoinAddress: COIN,
        bundleStatus: 'required',
      }),
    )
    expect(view.statusLabel).toBe('Launch bundle required')
    expect(view.primaryAction).toEqual({
      label: 'Unlock deployment',
      href: '/creator/strategy/features',
    })
    expect(view.showPaywall).toBe(true)
  })

  it('never shows paywall for legacy stack with verified strategies', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        symbol: 'AKITA',
        creatorCoinAddress: COIN,
        vaultAddress: VAULT,
        bundleStatus: 'not_required',
        isLegacyStack: true,
        verifiedStrategies: ['Charm', 'Ajna', 'Solana'],
        activationComplete: true,
        auctionState: 'graduated',
        settlementComplete: true,
        hookAligned: null,
      }),
    )
    expect(view.showPaywall).toBe(false)
    expect(view.legacyBadge).toBe('Charm · Ajna · Solana')
    expect(view.statusLabel).toBe('Trading live')
    expect(view.primaryAction?.label).toBe('View vault')
    expect(view.primaryAction?.href).toBe(`/vault/${VAULT}`)
  })

  it('does not show legacy badge without verified strategies', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        isLegacyStack: true,
        verifiedStrategies: [],
        vaultAddress: VAULT,
        activationComplete: true,
        auctionState: 'graduated',
        settlementComplete: true,
      }),
    )
    expect(view.legacyBadge).toBeNull()
  })

  it('requires activation when vault is deployed but unfunded', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        symbol: 'NEW',
        vaultAddress: VAULT,
        activationComplete: false,
        auctionState: 'none',
        bundleStatus: 'unlocked',
      }),
    )
    expect(view.statusLabel).toBe('Vault deployed · activation required')
    expect(view.primaryAction).toEqual({
      label: 'Activate vault',
      href: '/deploy/vault',
    })
  })

  it('maps scheduled and live auction states', () => {
    const scheduled = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        vaultAddress: VAULT,
        ccaLaunchArm: ARM,
        activationComplete: true,
        auctionState: 'scheduled',
      }),
    )
    expect(scheduled.statusLabel).toBe('Auction scheduled')
    expect(scheduled.primaryAction).toEqual({
      label: 'View launch',
      href: `/auction/bid/${ARM}`,
    })

    const live = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        vaultAddress: VAULT,
        ccaLaunchArm: ARM,
        activationComplete: true,
        auctionState: 'live',
      }),
    )
    expect(live.statusLabel).toBe('Fair-launch auction live')
    expect(live.primaryAction?.label).toBe('Join or monitor auction')
  })

  it('maps graduated-but-not-settled to settlement in progress', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        vaultAddress: VAULT,
        activationComplete: true,
        auctionState: 'graduated',
        settlementComplete: false,
      }),
    )
    expect(view.statusLabel).toBe('Settlement in progress')
    expect(view.primaryAction?.label).toBe('View status')
    expect(view.primaryAction?.href).toBe(`/status?vault=${VAULT}`)
  })

  it('requires graduation + settlement for Trading live; hookAligned false blocks it', () => {
    const live = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        vaultAddress: VAULT,
        activationComplete: true,
        auctionState: 'graduated',
        settlementComplete: true,
        hookAligned: null,
      }),
    )
    expect(live.statusLabel).toBe('Trading live')

    const blocked = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        vaultAddress: VAULT,
        activationComplete: true,
        auctionState: 'graduated',
        settlementComplete: true,
        hookAligned: false,
      }),
    )
    expect(blocked.statusLabel).not.toBe('Trading live')
  })

  it('does not treat vault presence alone as trading live', () => {
    // Vault + activation without auction graduation/settlement must not say Trading live
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        vaultAddress: VAULT,
        activationComplete: true,
        auctionState: 'none',
        settlementComplete: false,
      }),
    )
    expect(view.statusLabel).not.toBe('Trading live')
    expect(view.statusLabel).toBe('Activated')
  })

  it('overrides with account action when signing requires action', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        vaultAddress: VAULT,
        accountSigningStatus: 'action_required',
        activationComplete: true,
        auctionState: 'live',
      }),
    )
    expect(view.statusLabel).toBe('Account action required')
    expect(view.primaryAction).toEqual({
      label: 'Fix account setup',
      href: '/accounts',
    })
  })

  it('renders holder role from share holdings without ownership', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: false,
        hasShareHoldings: true,
        symbol: 'AKITA',
        vaultAddress: VAULT,
        shareOftBalance: '42600',
        activationComplete: true,
        auctionState: 'graduated',
        settlementComplete: true,
      }),
    )
    expect(view.role).toBe('holder')
    expect(view.headline).toBe('Your $AKITA position')
    expect(view.holder?.shareOftBalance).toBe('42600')
    expect(view.preferEconomyTab).toBe(true)
  })

  it('exposes a single primary action (mutually exclusive CTAs)', () => {
    const view = resolveCreatorEconomyView(
      createCreatorEconomyCapabilitiesFixture({
        hasCreatorCoin: true,
        hasVault: true,
        ownsCreatorEconomy: true,
        vaultAddress: VAULT,
        activationComplete: false,
        auctionState: 'none',
      }),
    )
    expect(view.primaryAction).not.toBeNull()
    expect(view.primaryAction?.label).toBe('Activate vault')
    // Secondary may exist, but must not duplicate competing deploy CTAs
    expect(view.secondaryLink?.label).not.toBe('Activate vault')
    expect(view.secondaryLink?.label).not.toBe('Unlock deployment')
  })
})
