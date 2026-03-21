import { describe, expect, it } from 'vitest'

import { shouldAutoRouteToAi } from '../_handlers/telegram/webhook/parsers/command.js'
import { resolveHelpCallbackCommand, resolveNavigationCallbackToast } from '../_handlers/telegram/webhook/parsers/callbackMenu.js'
import { parseDeployCallbackData, parseTelegramDeployIntent } from '../_handlers/telegram/webhook/parsers/deploy.js'
import { parseHolderRoomIdentifier } from '../_handlers/telegram/webhook/parsers/holderRooms.js'
import { buildInlineQueryAnswer, classifyInlineQuery } from '../_handlers/telegram/webhook/parsers/inline.js'
import { commandHasArguments, parseTelegramTradeIntent, parseTradeCallbackData, parseTradeFlowCallbackData } from '../_handlers/telegram/webhook/parsers/trade.js'

describe('telegram webhook parsers', () => {
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
    expect(classifyInlineQuery('arena tune attack=100')).toBe('arena')
    expect(classifyInlineQuery('zones commander sw')).toBe('arena')
    expect(classifyInlineQuery('mkt quote btc')).toBe('market')
    expect(classifyInlineQuery('ask ai')).toBe('ai')
    expect(classifyInlineQuery('')).toBe('discovery')
  })

  it('maps arena help shortcut callbacks to concrete commands', () => {
    expect(resolveHelpCallbackCommand('help:arena_tune')).toBe(
      '/arena tune attack=100 eco=2.1 expansion=2.4 retreat=0.55 defense=1.3 air=0.4 raid=14 safety=8',
    )
    expect(resolveHelpCallbackCommand('help:arena_rules')).toBe('/arena rules ECO:6 TECH:7 DEF:4 AIR:3 ASSIST:6')
    expect(resolveHelpCallbackCommand('help:arena_zones')).toBe('/arena zones C:attack W:defend N:scout commander=SW')
    expect(resolveHelpCallbackCommand('help:arena_control')).toBe('/arena control ECO:6 TECH:7 C:attack NE:scout commander=SW')
    expect(resolveHelpCallbackCommand('help:arena_play')).toBe('/arena play')
    expect(resolveHelpCallbackCommand('help:arena_find')).toBe('/arena find')
    expect(resolveHelpCallbackCommand('help:arena_state')).toBe('/arena state')
    expect(resolveHelpCallbackCommand('help:arena_result')).toBe('/arena result')
    expect(resolveHelpCallbackCommand('help:arena_watch_on')).toBe('/arena watch on')
    expect(resolveHelpCallbackCommand('help:arena_watch_status')).toBe('/arena watch status')
    expect(resolveNavigationCallbackToast('help:arena_control', '/arena control ECO:6 TECH:7 C:attack NE:scout commander=SW')).toBe(
      'Arena control template',
    )
    expect(resolveNavigationCallbackToast('help:arena_find', '/arena find')).toBe('Arena find match')
    expect(resolveNavigationCallbackToast('help:arena_watch_status', '/arena watch status')).toBe('Arena watch status')
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

  it('builds paginated inline answers with deterministic next_offset', () => {
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
      rawQuery: 'start trading',
      queryOffset: '',
      userId: '42',
      chatId: '-100123',
      isLinked: false,
      scopedVaults: [...scopedVaults],
      inlineResultCap: 4,
      growthMode: true,
      enablePmHandoff: true,
    })

    expect(firstPage.results.length).toBe(4)
    expect(firstPage.nextOffset).toBe('4')
    expect(firstPage.switchPmParameter).toMatch(/^inline_link_/)

    const secondPage = buildInlineQueryAnswer({
      rawQuery: 'start trading',
      queryOffset: firstPage.nextOffset,
      userId: '42',
      chatId: '-100123',
      isLinked: false,
      scopedVaults: [...scopedVaults],
      inlineResultCap: 4,
      growthMode: true,
      enablePmHandoff: true,
    })

    expect(secondPage.offset).toBe(4)
    expect(secondPage.results.length).toBeGreaterThan(0)
    expect(secondPage.results[0]?.id).not.toBe(firstPage.results[0]?.id)
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
        'card:market': {
          videoUrl: 'https://example.com/market.mp4',
          thumbnailUrl: 'https://example.com/market.png',
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
      menuButtonUrl: 'https://app.4626.fun/telegram/menu',
    })
    expect(linked.button).toEqual({
      text: 'Open 4626',
      web_app: { url: 'https://app.4626.fun/telegram/menu' },
    })
    expect(linked.switchPmParameter).toBeUndefined()
  })

  it('includes a live signals inline card with inline controls', () => {
    const answer = buildInlineQueryAnswer({
      rawQuery: 'signals live',
      queryOffset: '',
      userId: '42',
      chatId: '-100123',
      isLinked: true,
      scopedVaults: [],
      inlineResultCap: 8,
      growthMode: false,
      enablePmHandoff: true,
    })

    const liveCard = answer.results.find((entry: any) => String(entry?.id ?? '').includes('signals-live')) as any
    expect(liveCard).toBeTruthy()
    expect(String(liveCard?.title ?? '')).toBe('Signals Live')
    expect(String(liveCard?.input_message_content?.message_text ?? '')).toContain('Loading live signals')
    const buttons = Array.isArray(liveCard?.reply_markup?.inline_keyboard)
      ? liveCard.reply_markup.inline_keyboard.flat()
      : []
    expect(buttons.map((button: any) => String(button?.callback_data ?? ''))).toEqual([
      'livefeed:signals:refresh',
      'livefeed:signals:pause',
      'livefeed:signals:close',
    ])
  })
})
