import { getAddress, isAddress } from 'viem'

import {
  buildTelegramAnalyzeInlineDraft,
  filterTelegramApprovedTradeVaults,
  resolveTelegramApprovedInlineTokenQuery,
  TELEGRAM_APPROVED_INLINE_TOKENS,
} from '../approvedTokens.js'
import { asTrimmed, isAddressLike, truncateAddress } from '../utils.js'
import { parseTelegramTradeIntent } from './trade.js'

export type InlineQueryClass = 'trade' | 'market' | 'ai' | 'link' | 'deploy' | 'discovery' | 'general' | 'token_analysis'

export type InlineMediaAsset = {
  photoUrl?: string
  thumbnailUrl?: string
  videoUrl?: string
  mpeg4GifUrl?: string
  documentUrl?: string
  documentMimeType?: string
  videoMimeType?: string
}

export type InlineScopedVaultRow = {
  vaultAddress: string
  creatorCoinAddress: string
  chainId: number
  groupId: string
  isSettled: boolean
  ccaStrategyAddress: string | null
}

type InlineResultTemplate = {
  key: string
  title: string
  description: string
  command: string
  inputMessageText?: string
  replyMarkup?: Record<string, unknown>
  baseScore: number
  intentTags: InlineQueryClass[]
  mediaKey?: string
}

export type InlineQueryAnswer = {
  results: Array<Record<string, unknown>>
  nextOffset: string
  queryClass: InlineQueryClass
  offset: number
  totalResults: number
  button?: Record<string, unknown>
  switchPmText?: string
  switchPmParameter?: string
}

export type BuildInlineQueryAnswerParams = {
  rawQuery: string
  queryOffset: string
  userId: string
  chatId: string
  isLinked: boolean
  scopedVaults: InlineScopedVaultRow[]
  inlineResultCap: number
  growthMode: boolean
  enablePmHandoff: boolean
  mediaByKey?: Record<string, InlineMediaAsset>
  menuButtonUrl?: string
  linkButtonUrl?: string
}

function normalizeInlineDraft(rawQuery: string): string {
  const compact = asTrimmed(rawQuery).replace(/\s+/g, ' ')
  const stripped = compact
    .replace(/^\/?x\s+post\s+/i, '')
    .replace(/^\/?tweet\s+/i, '')
    .replace(/\s*--confirm\b/gi, '')
    .trim()
  const truncated = stripped.slice(0, 240).trim()
  return truncated || 'your update here'
}

function inferMarketSymbol(rawQuery: string): string {
  const token = asTrimmed(rawQuery).split(/\s+/g)[0] ?? ''
  return /^[a-zA-Z]{1,10}$/.test(token) ? token.toUpperCase() : 'BTC'
}

function parseInlineOffset(rawOffset: string): number {
  const parsed = Number(asTrimmed(rawOffset))
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.floor(parsed)
}

function clampInlineResultCap(value: number): number {
  if (!Number.isFinite(value)) return 8
  return Math.max(3, Math.min(20, Math.floor(value)))
}

export function normalizeInlineTokenAddress(rawQuery: string): `0x${string}` | null {
  const trimmed = asTrimmed(rawQuery)
  const approvedToken = resolveTelegramApprovedInlineTokenQuery(trimmed)
  if (approvedToken) return approvedToken.address
  if (!trimmed || /\s/.test(trimmed)) return null
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed).toLowerCase() as `0x${string}`
}

export function classifyInlineQuery(rawQuery: string): InlineQueryClass {
  const trimmed = asTrimmed(rawQuery)
  if (!trimmed) return 'discovery'
  if (normalizeInlineTokenAddress(trimmed)) return 'token_analysis'
  const query = trimmed.toLowerCase()
  if (parseTelegramTradeIntent(query.startsWith('/') ? query : `/${query}`)) return 'trade'
  if (/\b(buy|sell|bid|trade)\b/.test(query)) return 'trade'
  if (/\b(mkt|market|quote|price|btc|eth|sol)\b/.test(query)) return 'market'
  if (/\b(ai|assistant|prompt|question|analyze)\b/.test(query)) return 'ai'
  if (/\b(link|wallet|connect)\b/.test(query)) return 'link'
  if (/\b(deploy|launch|create)\b/.test(query)) return 'deploy'
  if (/\b(vault|auction|signal|wallet)\b/.test(query)) return 'discovery'
  return 'general'
}

function sanitizeStartParameter(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return cleaned || 'inline_link'
}

function isHttpUrl(value: unknown): value is string {
  const url = asTrimmed(value)
  return /^https?:\/\/[^\s]+$/i.test(url)
}

function materializeInlineResult(params: {
  template: InlineResultTemplate
  id: string
  mediaByKey: Record<string, InlineMediaAsset>
}): Record<string, unknown> {
  const { template, id, mediaByKey } = params
  const media = template.mediaKey ? mediaByKey[template.mediaKey] : null
  if (media) {
    if (isHttpUrl(media.photoUrl)) {
      return {
        type: 'photo',
        id,
        photo_url: media.photoUrl,
        thumbnail_url: isHttpUrl(media.thumbnailUrl) ? media.thumbnailUrl : media.photoUrl,
        title: template.title,
        description: template.description,
        input_message_content: { message_text: template.inputMessageText ?? template.command },
        ...(template.replyMarkup ? { reply_markup: template.replyMarkup } : {}),
      }
    }
    if (isHttpUrl(media.videoUrl)) {
      return {
        type: 'video',
        id,
        video_url: media.videoUrl,
        mime_type: asTrimmed(media.videoMimeType) || 'video/mp4',
        thumbnail_url: isHttpUrl(media.thumbnailUrl) ? media.thumbnailUrl : media.videoUrl,
        title: template.title,
        description: template.description,
        input_message_content: { message_text: template.inputMessageText ?? template.command },
        ...(template.replyMarkup ? { reply_markup: template.replyMarkup } : {}),
      }
    }
    if (isHttpUrl(media.mpeg4GifUrl)) {
      return {
        type: 'mpeg4_gif',
        id,
        mpeg4_url: media.mpeg4GifUrl,
        thumbnail_url: isHttpUrl(media.thumbnailUrl) ? media.thumbnailUrl : media.mpeg4GifUrl,
        title: template.title,
        input_message_content: { message_text: template.inputMessageText ?? template.command },
        ...(template.replyMarkup ? { reply_markup: template.replyMarkup } : {}),
      }
    }
    if (isHttpUrl(media.documentUrl)) {
      return {
        type: 'document',
        id,
        title: template.title,
        document_url: media.documentUrl,
        mime_type: asTrimmed(media.documentMimeType) || 'application/pdf',
        description: template.description,
        input_message_content: { message_text: template.inputMessageText ?? template.command },
        ...(template.replyMarkup ? { reply_markup: template.replyMarkup } : {}),
      }
    }
  }

  return {
    type: 'article',
    id,
    title: template.title,
    description: template.description,
    input_message_content: { message_text: template.inputMessageText ?? template.command },
    ...(template.replyMarkup ? { reply_markup: template.replyMarkup } : {}),
  }
}

function scoreInlineResult(params: {
  template: InlineResultTemplate
  queryClass: InlineQueryClass
  rawQuery: string
  isLinked: boolean
}): number {
  const { template, queryClass, rawQuery, isLinked } = params
  let score = template.baseScore
  if (template.intentTags.includes(queryClass)) score += 40

  const query = asTrimmed(rawQuery).toLowerCase()
  if (query) {
    const haystack = `${template.title} ${template.description} ${template.command}`.toLowerCase()
    const queryTokens = query.split(/\s+/g).filter(Boolean).slice(0, 5)
    for (const token of queryTokens) {
      if (token.length < 2) continue
      if (haystack.includes(token)) score += 6
    }
  }

  if (!isLinked && template.key === 'link-account') score += 35
  if (isLinked && template.key === 'link-account') score -= 20
  return score
}

function buildCommonCopy(growthMode: boolean): {
  linkTitle: string
  linkDescription: string
  walletTitle: string
  walletDescription: string
  helpTitle: string
  helpDescription: string
  statusTitle: string
  statusDescription: string
  xPostTitle: string
  xPostDescription: string
  aiTitle: string
  aiDescription: string
  marketTitle: string
  marketDescription: string
} {
  if (growthMode) {
    return {
      linkTitle: 'Connect wallet',
      linkDescription: 'One-time setup • buy, sell, bid',
      walletTitle: 'Wallet',
      walletDescription: 'Positions, status, recent activity',
      helpTitle: 'Guide',
      helpDescription: 'Shortcuts and starter flows',
      statusTitle: 'Vault health',
      statusDescription: 'Live config and permissions',
      xPostTitle: 'Draft X post',
      xPostDescription: 'Template ready to send',
      aiTitle: 'Ask AI',
      aiDescription: 'Get one clear next action',
      marketTitle: 'Market quote',
      marketDescription: 'Fast BTC, ETH, SOL',
    }
  }

  return {
    linkTitle: 'Connect wallet',
    linkDescription: 'One-time setup • unlock trading',
    walletTitle: 'Wallet',
    walletDescription: 'Positions, recent actions, status',
    helpTitle: 'Guide',
    helpDescription: 'Starter commands and shortcuts',
    statusTitle: 'Vault health check',
    statusDescription: 'Config, permissions, live status',
    xPostTitle: 'Draft X post',
    xPostDescription: 'Pre-filled with callback confirm',
    aiTitle: 'Ask AI',
    aiDescription: 'Get next actions in plain English',
    marketTitle: 'Market quote',
    marketDescription: 'Fast quote for BTC/ETH and more',
  }
}

export function buildInlineQueryAnswer(params: BuildInlineQueryAnswerParams): InlineQueryAnswer {
  const query = asTrimmed(params.rawQuery)
  const normalizedQuery = query.replace(/\s+/g, ' ')
  const queryClass = classifyInlineQuery(normalizedQuery)
  const cap = clampInlineResultCap(params.inlineResultCap)
  const isDefaultDiscovery = queryClass === 'discovery' || queryClass === 'general'
  const effectiveCap = isDefaultDiscovery ? Math.min(cap, 8) : cap
  const offset = parseInlineOffset(params.queryOffset)
  const growthMode = params.growthMode
  const mediaByKey = params.mediaByKey ?? {}
  const tradeIntent = parseTelegramTradeIntent(normalizedQuery.startsWith('/') ? normalizedQuery : `/${normalizedQuery}`)
  const tradeFlowHint = '3 taps • vault • size • accept'
  const xPostCommand = `/x post ${normalizeInlineDraft(normalizedQuery)}`
  const aiPrompt = normalizedQuery ? `/ai ${normalizedQuery}` : '/ai What should I do next?'
  const marketQuote = `/mkt quote ${inferMarketSymbol(normalizedQuery)}`
  const copy = buildCommonCopy(growthMode)
  const lowerQuery = normalizedQuery.toLowerCase()
  const wantsDeploy = queryClass === 'deploy' || /\b(deploy|launch|create)\b/.test(lowerQuery)
  const wantsStatus = /\b(status|health|permissions)\b/.test(lowerQuery)
  const wantsSocial = /\b(x|tweet|post)\b/.test(lowerQuery)
  const wantsAi = queryClass === 'ai'
  const wantsMarket = queryClass === 'market'
  const wantsSignals = /\b(signal|signals|feed|live)\b/.test(lowerQuery) || queryClass === 'discovery'
  const approvedScopedVaults = filterTelegramApprovedTradeVaults(params.scopedVaults)

  const templates: InlineResultTemplate[] = []
  const pushTemplate = (template: InlineResultTemplate) => {
    templates.push(template)
  }

  if (tradeIntent) {
    const tradeCommand = tradeIntent.actionType === 'buy' ? '/buy' : tradeIntent.actionType === 'sell' ? '/sell' : '/bid'
    pushTemplate({
      key: 'trade-intent',
      title:
        tradeIntent.actionType === 'buy'
          ? 'Buy now'
          : tradeIntent.actionType === 'sell'
            ? 'Sell now'
            : 'Bid now',
      description: tradeFlowHint,
      command: tradeCommand,
      baseScore: 120,
      intentTags: ['trade'],
      mediaKey: 'card:trade',
    })
  }

  if (!params.isLinked) {
    pushTemplate({
      key: 'link-account',
      title: copy.linkTitle,
      description: copy.linkDescription,
      command: '/link',
      baseScore: 110,
      intentTags: ['trade', 'link', 'general'],
      mediaKey: 'card:link',
    })
  }

  TELEGRAM_APPROVED_INLINE_TOKENS.forEach((token, index) => {
    const scopedVault = approvedScopedVaults.find((vault) => vault.approvedToken.address === token.address)
    const description = !params.isLinked
      ? 'Approved token • link first to trade'
      : scopedVault
        ? 'Approved token • direct buy flow'
        : 'Approved token • trade availability depends on this chat'
    pushTemplate({
      key: `approved-buy-${token.symbol.toLowerCase()}`,
      title: token.buyLabel,
      description,
      command: '/buy',
      replyMarkup: {
        inline_keyboard: [[{ text: token.analyzeLabel, switch_inline_query_current_chat: buildTelegramAnalyzeInlineDraft(token) }]],
      },
      baseScore: 104 - index,
      intentTags: ['trade', 'discovery', 'general'],
      mediaKey: 'card:buy',
    })
  })

  if (wantsSignals) {
    pushTemplate({
      key: 'signals-live',
      title: 'Signals Live',
      description: 'Auto-updating trade feed',
      command: '/signals',
      inputMessageText: 'Loading live signals…',
      replyMarkup: {
        inline_keyboard: [[
          { text: 'Refresh', callback_data: 'livefeed:signals:refresh' },
          { text: 'Pause', callback_data: 'livefeed:signals:pause' },
          { text: 'Close', callback_data: 'livefeed:signals:close' },
        ]],
      },
      baseScore: 96,
      intentTags: ['discovery', 'trade', 'general'],
      mediaKey: 'card:signals',
    })
  }
  // Keep inline discovery focused on link + approved-token trading.
  // Only show the broader utility surfaces when the query explicitly asks for them.
  if (wantsStatus) {
    pushTemplate({
      key: 'status',
      title: copy.statusTitle,
      description: copy.statusDescription,
      command: '/keepr status',
      baseScore: 71,
      intentTags: ['discovery', 'general'],
      mediaKey: 'card:status',
    })
  }
  if (params.isLinked && /\bwallet\b/.test(lowerQuery)) {
    pushTemplate({
      key: 'wallet',
      title: copy.walletTitle,
      description: copy.walletDescription,
      command: '/wallet',
      baseScore: 83,
      intentTags: ['discovery', 'general'],
      mediaKey: 'card:portfolio',
    })
  }
  if (wantsDeploy || wantsSocial) {
    pushTemplate({
      key: 'xpost',
      title: copy.xPostTitle,
      description: copy.xPostDescription,
      command: xPostCommand,
      baseScore: 68,
      intentTags: ['general', 'deploy'],
      mediaKey: 'card:xpost',
    })
  }
  if (wantsAi) {
    pushTemplate({
      key: 'ai',
      title: copy.aiTitle,
      description: copy.aiDescription,
      command: aiPrompt,
      baseScore: 67,
      intentTags: ['ai', 'general', 'market'],
      mediaKey: 'card:ai',
    })
  }
  if (wantsMarket) {
    pushTemplate({
      key: 'market',
      title: copy.marketTitle,
      description: copy.marketDescription,
      command: marketQuote,
      baseScore: 66,
      intentTags: ['market', 'general'],
      mediaKey: 'card:market',
    })
  }
  if (wantsDeploy) {
    pushTemplate({
      key: 'deploy',
      title: 'Deploy vault',
      description: 'Launch directly from Telegram',
      command: '/deploy',
      baseScore: 76,
      intentTags: ['deploy', 'discovery'],
      mediaKey: 'card:deploy',
    })
  }

  const rankedTemplates = templates
    .map((template) => ({
      template,
      score: scoreInlineResult({
        template,
        queryClass,
        rawQuery: normalizedQuery,
        isLinked: params.isLinked,
      }),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.template.key.localeCompare(right.template.key)
    })

  const pagedTemplates = rankedTemplates.slice(offset, offset + effectiveCap)
  const results = pagedTemplates.map(({ template }, idx) => {
    const absoluteRank = offset + idx
    const result = materializeInlineResult({ template, id: 'pending', mediaByKey })
    const resultType = asTrimmed(result.type ?? 'article').toLowerCase()
    const resultId = `r${absoluteRank}:${resultType}:${template.key}`.slice(0, 64)
    return {
      ...result,
      id: resultId,
    }
  })
  const totalResults = rankedTemplates.length
  const nextOffset = offset + effectiveCap < totalResults ? String(offset + effectiveCap) : ''

  const shouldShowPmHandoff = params.enablePmHandoff && !params.isLinked
  const pmParameter = sanitizeStartParameter(`inline_link_${queryClass}`)
  const button =
    params.isLinked && params.menuButtonUrl
      ? {
          text: 'Open 4626',
          web_app: { url: params.menuButtonUrl },
        }
      : shouldShowPmHandoff
        ? params.linkButtonUrl
          ? {
              text: 'Connect wallet',
              web_app: { url: params.linkButtonUrl },
            }
          : {
              text: 'Connect wallet',
              start_parameter: pmParameter,
            }
        : undefined
  return {
    results,
    offset,
    nextOffset,
    queryClass,
    totalResults,
    ...(button
      ? {
          button,
          ...(shouldShowPmHandoff
            ? {
                switchPmText: 'Connect wallet',
                switchPmParameter: pmParameter,
              }
            : {}),
        }
      : {}),
  }
}
