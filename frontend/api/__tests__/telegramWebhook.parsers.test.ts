import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { shouldAutoRouteToAi } from '../_handlers/telegram/webhook/parsers/command.js'
import { resolveHelpCallbackCommand, resolveNavigationCallbackToast } from '../_handlers/telegram/webhook/parsers/callbackMenu.js'
import { parseDeployCallbackData, parseTelegramDeployIntent } from '../_handlers/telegram/webhook/parsers/deploy.js'
import { parseHolderRoomIdentifier } from '../_handlers/telegram/webhook/parsers/holderRooms.js'
import {
  buildInlineTokenAnalysisAnswer,
  renderCatchUpMessage,
  renderRiskMessage,
  renderTokenSnapshotMessage,
} from '../_handlers/telegram/webhook/inlineTokenFormatting.js'
import {
  scoreTokenMetadataQuality,
  selectStrongestSupportedMarket,
  type ResolvedInlineTokenAnalysis,
} from '../_handlers/telegram/webhook/services/inlineTokenAnalysis.js'
import { buildInlineQueryAnswer, classifyInlineQuery, normalizeInlineTokenAddress } from '../_handlers/telegram/webhook/parsers/inline.js'
import { commandHasArguments, parseTelegramTradeIntent, parseTradeCallbackData, parseTradeFlowCallbackData } from '../_handlers/telegram/webhook/parsers/trade.js'

describe('telegram webhook parsers', () => {
  const exampleChecksumAddress = getAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
  const exampleToken: ResolvedInlineTokenAnalysis = {
    kind: 'resolved',
    normalizedAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    checksumAddress: exampleChecksumAddress,
    chain: 'base',
    chainLabel: 'Base',
    dexId: 'uniswap',
    dexUrl: 'https://dexscreener.com/base/0x0000000000000000000000000000000000000001',
    pairAddress: '0x1111111111111111111111111111111111111111',
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logoUrl: 'https://example.com/usdc.png',
    metadataQualityScore: 31,
    verifiedTokenMetadataPresent: true,
    ageSource: 'token_created',
    createdAt: '2026-03-20T12:00:00.000Z',
    marketCapUsd: 1_250_000_000,
    fdvUsd: 1_250_000_000,
    liquidityUsd: 8_750_000,
    volume24hUsd: 42_500_000,
    volume6hUsd: 11_000_000,
    volume1hUsd: 2_600_000,
    volume5mUsd: 125_000,
    holders: 121_000,
    priceChange24h: 0.0021,
    buys24h: 42_100,
    sells24h: 41_980,
    buys1h: 1_980,
    sells1h: 1_910,
    vaultLink: {
      linked: true,
      relation: 'creator_coin',
      vaultAddress: '0x2222222222222222222222222222222222222222',
      creatorCoinAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      shareTokenAddress: '0x3333333333333333333333333333333333333333',
      creatorLabel: 'Akita Treasury',
    },
    secondary: {
      risk: {
        ownership: 'owned',
        mint: null,
        blacklist: null,
        proxy: 'no',
        taxBps: null,
        liquidityStatus: 'unknown',
      },
      metadataQuality: {
        verifiedTokenMetadataPresent: true,
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        logoUrl: 'https://example.com/usdc.png',
        supportsLogo: true,
      },
      createdAt: '2026-03-20T12:00:00.000Z',
      holders: 121_000,
      creatorLabel: 'Akita Treasury',
    },
  }

  it('parses buy, sell, and bid trade intents', () => {
    expect(parseTelegramTradeIntent('/buy 0x1111111111111111111111111111111111111111 0.42')).toMatchObject({
      actionType: 'buy',
      amountUnit: 'ETH',
      amountInput: '0.42',
    })
    expect(parseTelegramTradeIntent('/sell 0x1111111111111111111111111111111111111111 12.5')).toMatchObject({
      actionType: 'sell',
      amountUnit: 'SHARE',
      amountInput: '12.5',
    })
    expect(parseTelegramTradeIntent('/bid 0x1111111111111111111111111111111111111111 $99')).toMatchObject({
      actionType: 'bid',
      amountUnit: 'USD',
      amountInput: '99',
    })
  })

  it('rejects malformed trade intents', () => {
    expect(parseTelegramTradeIntent('/buy')).toBeNull()
    expect(parseTelegramTradeIntent('/bid vault not-a-number')).toBeNull()
  })

  it('detects whether interactive trade command has arguments', () => {
    expect(commandHasArguments('/buy', 'buy')).toBe(false)
    expect(commandHasArguments('/buy vault 1', 'buy')).toBe(true)
    expect(commandHasArguments('/sell vault 10', 'sell')).toBe(true)
  })

  it('parses tradeflow callback payloads', () => {
    expect(parseTradeFlowCallbackData('tradeflow:v:buy:0x1111111111111111111111111111111111111111')).toEqual({
      kind: 'vault',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
    })
    expect(parseTradeFlowCallbackData('tradeflow:p:sell:0x1111111111111111111111111111111111111111:2500')).toEqual({
      kind: 'percent',
      actionType: 'sell',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      percentBps: 2500,
    })
    expect(parseTradeFlowCallbackData('tradeflow:c:bid:0x1111111111111111111111111111111111111111')).toEqual({
      kind: 'custom',
      actionType: 'bid',
      vaultAddress: '0x1111111111111111111111111111111111111111',
    })
    expect(parseTradeFlowCallbackData('tradeflow:p:buy:0x1111111111111111111111111111111111111111:99999')).toBeNull()
  })

  it('parses canonical trade callbacks for accept/decline', () => {
    expect(parseTradeCallbackData('trade:accept:abc123')).toEqual({ kind: 'accept', token: 'abc123' })
    expect(parseTradeCallbackData('trade:decline:abc123')).toEqual({ kind: 'decline', token: 'abc123' })
    expect(parseTradeCallbackData('trade:confirm:abc123')).toBeNull()
    expect(parseTradeCallbackData('trade:cancel:abc123')).toBeNull()
    expect(parseTradeCallbackData('trade:edit:buy')).toEqual({ kind: 'edit', actionType: 'buy' })
  })

  it('parses deploy command intents and canonical callbacks', () => {
    expect(parseTelegramDeployIntent('/deploy')).toEqual({ kind: 'menu' })
    expect(parseTelegramDeployIntent('/deploy trend BASEAI')).toEqual({ kind: 'trend', ticker: 'BASEAI' })

    const coinIntent = parseTelegramDeployIntent('/deploy content "Base Daily Recap" BDR')
    expect(coinIntent?.kind).toBe('coin')
    expect(coinIntent && coinIntent.kind === 'coin' ? coinIntent.commandCurrency : null).toBe('CREATOR_COIN')

    expect(parseDeployCallbackData('deploy:confirm:tok_123')).toEqual({ kind: 'confirm', token: 'tok_123' })
    expect(parseDeployCallbackData('deploy:decline:tok_123')).toEqual({ kind: 'decline', token: 'tok_123' })
    expect(parseDeployCallbackData('deploy:accept:tok_123')).toBeNull()
    expect(parseDeployCallbackData('deploy:cancel:tok_123')).toBeNull()
  })

  it('parses holder-room identifiers from join and eligibility commands', () => {
    expect(parseHolderRoomIdentifier('/join BASEAI', 'join')).toBe('BASEAI')
    expect(parseHolderRoomIdentifier('/eligibility 0x1111111111111111111111111111111111111111', 'eligibility')).toBe(
      '0x1111111111111111111111111111111111111111',
    )
    expect(parseHolderRoomIdentifier('/join', 'join')).toBe('')
  })

  it('auto-routes follow-up text into AI only when expected', () => {
    const isPrivateChatId = (chatId: string) => !chatId.startsWith('-')

    expect(
      shouldAutoRouteToAi({
        chatId: '7726886643',
        text: 'how are we doing',
        message: {},
        aiFollowupEnabled: true,
        isPrivateChatId,
      }),
    ).toBe(false)

    expect(
      shouldAutoRouteToAi({
        chatId: '7726886643',
        text: '@keepr how are we doing',
        message: {},
        aiFollowupEnabled: true,
        isPrivateChatId,
      }),
    ).toBe(true)

    expect(
      shouldAutoRouteToAi({
        chatId: '7726886643',
        text: '@akitai_bot how are we doing',
        message: {},
        aiFollowupEnabled: true,
        isPrivateChatId,
      }),
    ).toBe(true)

    expect(
      shouldAutoRouteToAi({
        chatId: '-1001',
        text: 'how are we doing',
        message: { reply_to_message: { from: { is_bot: true } } },
        aiFollowupEnabled: true,
        isPrivateChatId,
      }),
    ).toBe(true)

    expect(
      shouldAutoRouteToAi({
        chatId: '-1001',
        text: '/help',
        message: {},
        aiFollowupEnabled: true,
        isPrivateChatId,
      }),
    ).toBe(false)
  })

  it('classifies inline query intent for ranking', () => {
    expect(classifyInlineQuery('/buy vault 0.1')).toBe('trade')
    expect(classifyInlineQuery('mkt quote btc')).toBe('ai')
    expect(classifyInlineQuery('ask ai')).toBe('ai')
    expect(classifyInlineQuery('')).toBe('discovery')
    expect(classifyInlineQuery(`  ${exampleChecksumAddress}  `)).toBe('token_analysis')
    expect(classifyInlineQuery(`${exampleChecksumAddress} risk`)).not.toBe('token_analysis')
  })

  it('normalizes exact bare token addresses only after trimming', () => {
    expect(normalizeInlineTokenAddress(` ${exampleChecksumAddress} `)).toBe(
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    )
    expect(normalizeInlineTokenAddress('query $AKITA')).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
    expect(normalizeInlineTokenAddress('analyze $AKITA')).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
    expect(normalizeInlineTokenAddress(`${exampleChecksumAddress} risk`)).toBeNull()
    expect(normalizeInlineTokenAddress(`${exampleChecksumAddress}\nfoo`)).toBeNull()
  })

  it('leaves removed arena help callbacks unmapped', () => {
    expect(resolveHelpCallbackCommand('help:arena_tune')).toBeNull()
    expect(resolveHelpCallbackCommand('help:arena_play')).toBeNull()
    expect(resolveHelpCallbackCommand('help:arena_watch_status')).toBeNull()
    expect(resolveNavigationCallbackToast('help:arena_play', null)).toBe('Help topic')
  })

  it('maps CRE and Solana operator callbacks to concrete commands', () => {
    expect(resolveHelpCallbackCommand('cre:status')).toBe('/cre status')
    expect(resolveHelpCallbackCommand('cre:auction')).toBe('/cre auction')
    expect(resolveHelpCallbackCommand('cre:solana')).toBe('/cre solana')
    expect(resolveHelpCallbackCommand('cre:health')).toBe('/cre health')
    expect(resolveHelpCallbackCommand('cre:tend')).toBe('/cre tend')
    expect(resolveHelpCallbackCommand('cre:report')).toBe('/cre report')
    expect(resolveHelpCallbackCommand('cre:settle-fees')).toBe('/cre settle-fees')
    expect(resolveHelpCallbackCommand('cre:relay-entries')).toBe('/cre relay-entries')
    expect(resolveNavigationCallbackToast('menu:cre', null)).toBe('CRE ops')
    expect(resolveNavigationCallbackToast('menu:solana', null)).toBe('Solana ops')
    expect(resolveNavigationCallbackToast('cre:settle-fees', '/cre settle-fees')).toBe('Settling fees')
    expect(resolveNavigationCallbackToast('cre:relay-entries', '/cre relay-entries')).toBe('Relaying entries')
  })

  it('builds compressed inline answers with deterministic ids', () => {
    const scopedVaults = [
      {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        creatorCoinAddress: '0x2222222222222222222222222222222222222222',
        chainId: 8453,
        groupId: 'g1',
        isSettled: false,
        ccaStrategyAddress: '0x3333333333333333333333333333333333333333',
      },
      {
        vaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        creatorCoinAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        chainId: 8453,
        groupId: 'g2',
        isSettled: false,
        ccaStrategyAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      },
    ] as const

    const firstPage = buildInlineQueryAnswer({
      rawQuery: 'deploy status signal x',
      queryOffset: '',
      userId: '42',
      chatId: '-100123',
      isLinked: false,
      scopedVaults: [...scopedVaults],
      inlineResultCap: 4,
      growthMode: true,
      enablePmHandoff: true,
    })

    expect(firstPage.results.length).toBe(3)
    expect(firstPage.results.map((entry: any) => entry.title)).toEqual([
      'Connect wallet',
      'Query $AKITA',
      'Ask AI',
    ])
    expect(firstPage.nextOffset).toBe('')
    expect(firstPage.switchPmParameter).toMatch(/^inline_link_/)
    expect(firstPage.results.map((entry: any) => entry.id)).toEqual([
      'r0:article:link-account',
      'r1:article:approved-query-akita',
      'r2:article:ai',
    ])
  })

  it('uses media variants when configured and falls back to article', () => {
    const answer = buildInlineQueryAnswer({
      rawQuery: 'market quote btc',
      queryOffset: '',
      userId: '42',
      chatId: '-100123',
      isLinked: false,
      scopedVaults: [],
      inlineResultCap: 8,
      growthMode: true,
      enablePmHandoff: true,
      mediaByKey: {
        'card:link': {
          photoUrl: 'https://example.com/link.png',
          thumbnailUrl: 'https://example.com/thumb.png',
        },
        'card:ai': {
          videoUrl: 'https://example.com/ai.mp4',
          thumbnailUrl: 'https://example.com/ai.png',
        },
      },
    })

    const resultTypes = answer.results.map((entry: any) => String(entry?.type ?? ''))
    expect(resultTypes).toContain('photo')
    expect(resultTypes).toContain('video')
    expect(resultTypes).toContain('article')
  })

  it('uses Mini App button CTAs when inline launcher URLs are provided', () => {
    const unlinked = buildInlineQueryAnswer({
      rawQuery: 'start trading',
      queryOffset: '',
      userId: '42',
      chatId: '-100123',
      isLinked: false,
      scopedVaults: [],
      inlineResultCap: 8,
      growthMode: true,
      enablePmHandoff: true,
      linkButtonUrl: 'https://app.4626.fun/telegram/link',
    })
    expect(unlinked.button).toEqual({
      text: 'Connect wallet',
      web_app: { url: 'https://app.4626.fun/telegram/link' },
    })
    expect(unlinked.switchPmParameter).toMatch(/^inline_link_/)

    const linked = buildInlineQueryAnswer({
      rawQuery: 'vault picks',
      queryOffset: '',
      userId: '42',
      chatId: '-100123',
      isLinked: true,
      scopedVaults: [],
      inlineResultCap: 8,
      growthMode: false,
      enablePmHandoff: true,
    })
    expect(linked.button).toBeUndefined()
    expect(linked.switchPmParameter).toBeUndefined()
  })

  it('builds token analysis cards in the required order with deterministic ids', () => {
    const answer = buildInlineTokenAnalysisAnswer({
      resolution: exampleToken,
      nowMs: Date.parse('2026-03-23T12:00:00.000Z'),
    })

    expect(answer.queryClass).toBe('token_analysis')
    expect(answer.totalResults).toBe(7)
    expect(answer.results.map((entry: any) => entry.title)).toEqual([
      'Token Snapshot',
      'Catch Up',
      'Risk Scan',
      'Holder Breakdown',
      'Flow / Momentum',
      'Conviction Check',
      'Vault Link',
    ])
    expect(answer.results.map((entry: any) => entry.description)).toEqual([
      'Overview and key metrics',
      'Fast context summary',
      'Contract and structural risks',
      'Who owns this token',
      'Recent activity and momentum',
      'Bull vs bear case',
      '4626 / vault relationship',
    ])
    expect(answer.results.map((entry: any) => entry.id)).toEqual([
      'token:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:snapshot',
      'token:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:catchup',
      'token:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:risk',
      'token:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:holders',
      'token:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:flow',
      'token:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:conviction',
      'token:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913:vault',
    ])
    expect(
      answer.results.every(
        (entry: any) =>
          entry?.input_message_content?.parse_mode === 'HTML'
          && entry?.input_message_content?.disable_web_page_preview === true,
      ),
    ).toBe(true)
  })

  it('keeps token analysis ids stable across input address casing', () => {
    const lower = normalizeInlineTokenAddress('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
    const mixed = normalizeInlineTokenAddress(exampleChecksumAddress)
    expect(lower).toBe(mixed)

    const lowerAnswer = buildInlineTokenAnalysisAnswer({
      resolution: {
        ...exampleToken,
        normalizedAddress: lower!,
      },
      nowMs: Date.parse('2026-03-23T12:00:00.000Z'),
    })
    const mixedAnswer = buildInlineTokenAnalysisAnswer({
      resolution: {
        ...exampleToken,
        normalizedAddress: mixed!,
      },
      nowMs: Date.parse('2026-03-23T12:00:00.000Z'),
    })

    expect(lowerAnswer.results.map((entry: any) => entry.id)).toEqual(mixedAnswer.results.map((entry: any) => entry.id))
  })

  it('renders snapshot, catch up, and risk cards with stable premium formatting', () => {
    expect(renderTokenSnapshotMessage(exampleToken, Date.parse('2026-03-23T12:00:00.000Z'))).toMatchInlineSnapshot(`
      "<b>USD Coin (USDC)</b>
      <code>0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code> • Base • 3d

      MC: $1.3B • FDV: $1.3B
      Liq: $8.8M • Vol: $42.5M • Holders: 121K

      Vault: Akita Treasury

      <b>Summary:</b>
      Liquid Base market with heavy turnover and broad holder depth."
    `)
    expect(renderCatchUpMessage(exampleToken)).toMatchInlineSnapshot(`
      "<b>Catch Up</b>

      <b>What:</b> USD Coin (USDC) is trading on Base.
      <b>Why moving:</b> 24h price is +0.21% on $42.5M volume.
      <b>What changed:</b> Liquidity is $8.8M and holders are at 121K.
      <b>Now:</b> Vault-linked to Akita Treasury inside the 4626 surface.
      <b>Focus:</b> Watch order flow stay above 1910 sells against 1980 buys."
    `)
    expect(renderRiskMessage(exampleToken)).toMatchInlineSnapshot(`
      "<b>Risk Profile</b>

      Ownership: owned
      Proxy: no
      Liquidity: unknown

      <b>Verdict:</b>
      Owner privileges are still live; liquidity controls are not verified."
    `)
  })

  it('renders an unresolved fallback card with a deterministic id', () => {
    const answer = buildInlineTokenAnalysisAnswer({
      resolution: {
        kind: 'unresolved',
        normalizedAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        checksumAddress: getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
        reason: 'no_supported_active_market',
      },
    })

    expect(answer.totalResults).toBe(1)
    expect(answer.results[0]).toMatchObject({
      id: 'token:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:unresolved',
      title: 'Token Unresolved',
      description: 'No supported token or active market found',
    })
    expect(String((answer.results[0] as any)?.input_message_content?.message_text ?? '')).toContain(
      'Token metadata resolved, but no supported active market or meaningful liquidity was found.',
    )
  })

  it('selects fallback markets deterministically by liquidity, volume, metadata quality, then chain priority', () => {
    const normalizedAddress = '0x9999999999999999999999999999999999999999' as const
    const selection = selectStrongestSupportedMarket({
      normalizedAddress,
      pairs: [
        {
          chainId: 'ethereum',
          pairAddress: '0x1000000000000000000000000000000000000001',
          baseToken: { address: normalizedAddress, name: 'Example', symbol: 'EXM' },
          liquidity: { usd: 50_000 },
          volume: { h24: 10_000 },
          txns: { h24: { buys: 10, sells: 8 } },
        },
        {
          chainId: 'arbitrum',
          pairAddress: '0x1000000000000000000000000000000000000002',
          baseToken: { address: normalizedAddress, name: 'Example', symbol: 'EXM' },
          liquidity: { usd: 50_000 },
          volume: { h24: 10_000 },
          txns: { h24: { buys: 10, sells: 8 } },
        },
        {
          chainId: 'optimism',
          pairAddress: '0x1000000000000000000000000000000000000003',
          baseToken: { address: normalizedAddress, name: 'Example', symbol: '' },
          liquidity: { usd: 50_000 },
          volume: { h24: 11_000 },
          txns: { h24: { buys: 11, sells: 8 } },
        },
      ],
    })

    expect(selection.reason).toBeNull()
    expect(selection.candidate?.chain).toBe('optimism')

    const chainPriorityTie = selectStrongestSupportedMarket({
      normalizedAddress,
      pairs: [
        {
          chainId: 'ethereum',
          pairAddress: '0x1000000000000000000000000000000000000010',
          baseToken: { address: normalizedAddress, name: 'Example', symbol: 'EXM' },
          liquidity: { usd: 75_000 },
          volume: { h24: 15_000 },
          txns: { h24: { buys: 15, sells: 10 } },
        },
        {
          chainId: 'arbitrum',
          pairAddress: '0x1000000000000000000000000000000000000011',
          baseToken: { address: normalizedAddress, name: 'Example', symbol: 'EXM' },
          liquidity: { usd: 75_000 },
          volume: { h24: 15_000 },
          txns: { h24: { buys: 15, sells: 10 } },
        },
      ],
    })

    expect(chainPriorityTie.candidate?.chain).toBe('ethereum')
  })

  it('scores metadata quality deterministically', () => {
    expect(
      scoreTokenMetadataQuality({
        verifiedTokenMetadataPresent: true,
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        logoUrl: 'https://example.com/logo.png',
        supportsLogo: true,
      }),
    ).toBe(31)
    expect(
      scoreTokenMetadataQuality({
        verifiedTokenMetadataPresent: false,
        name: '',
        symbol: '',
        decimals: null,
        logoUrl: 'https://example.com/logo.png',
        supportsLogo: false,
      }),
    ).toBe(0)
  })

  it('keeps snapshot and catch up renderable from primary data alone', () => {
    const primaryOnly = {
      ...exampleToken,
      secondary: {
        risk: {
          ownership: null,
          mint: null,
          blacklist: null,
          proxy: null,
          taxBps: null,
          liquidityStatus: 'unknown',
        },
        metadataQuality: {},
        createdAt: null,
        holders: null,
        creatorLabel: null,
      },
    } satisfies ResolvedInlineTokenAnalysis

    expect(renderTokenSnapshotMessage(primaryOnly, Date.parse('2026-03-23T12:00:00.000Z'))).toContain('<b>Summary:</b>')
    expect(renderCatchUpMessage(primaryOnly)).toContain('<b>Focus:</b>')
  })
})
