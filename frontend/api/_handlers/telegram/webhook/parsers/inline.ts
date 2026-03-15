import { asTrimmed, isAddressLike, truncateAddress } from '../utils.js'
import { parseTelegramTradeIntent } from './trade.js'

export type InlineQueryClass = 'trade' | 'market' | 'ai' | 'link' | 'deploy' | 'discovery' | 'general'

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

export function classifyInlineQuery(rawQuery: string): InlineQueryClass {
  const query = asTrimmed(rawQuery).toLowerCase()
  if (!query) return 'discovery'
  if (parseTelegramTradeIntent(query.startsWith('/') ? query : `/${query}`)) return 'trade'
  if (/\b(buy|sell|bid|trade)\b/.test(query)) return 'trade'
  if (/\b(mkt|market|quote|price|btc|eth|sol)\b/.test(query)) return 'market'
  if (/\b(ai|assistant|prompt|question|analyze)\b/.test(query)) return 'ai'
  if (/\b(link|wallet|connect)\b/.test(query)) return 'link'
  if (/\b(deploy|launch|create)\b/.test(query)) return 'deploy'
  if (/\b(vault|auction|signal|portfolio)\b/.test(query)) return 'discovery'
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
        input_message_content: { message_text: template.command },
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
        input_message_content: { message_text: template.command },
      }
    }
    if (isHttpUrl(media.mpeg4GifUrl)) {
      return {
        type: 'mpeg4_gif',
        id,
        mpeg4_url: media.mpeg4GifUrl,
        thumbnail_url: isHttpUrl(media.thumbnailUrl) ? media.thumbnailUrl : media.mpeg4GifUrl,
        title: template.title,
        input_message_content: { message_text: template.command },
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
        input_message_content: { message_text: template.command },
      }
    }
  }

  return {
    type: 'article',
    id,
    title: template.title,
    description: template.description,
    input_message_content: { message_text: template.command },
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
  portfolioTitle: string
  portfolioDescription: string
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
      linkTitle: 'Unlock trading -> link wallet',
      linkDescription: 'One-time setup -> buy, sell, bid',
      portfolioTitle: 'Portfolio pulse',
      portfolioDescription: 'Positions + recent activity',
      helpTitle: 'Quick start (30 sec)',
      helpDescription: 'Beginner-first commands',
      statusTitle: 'Vault health',
      statusDescription: 'Live config + permissions',
      xPostTitle: 'Draft X post',
      xPostDescription: 'Template ready to send',
      aiTitle: 'Ask Keepr AI',
      aiDescription: 'Get one clear next action',
      marketTitle: 'Market quote',
      marketDescription: 'Fast BTC/ETH check',
    }
  }

  return {
    linkTitle: 'Link wallet to unlock trading',
    linkDescription: 'One-time setup, then buy/sell/bid instantly',
    portfolioTitle: 'My portfolio snapshot',
    portfolioDescription: 'Positions, recent actions, and status',
    helpTitle: 'Quick start guide',
    helpDescription: 'Beginner-friendly commands and shortcuts',
    statusTitle: 'Vault health check',
    statusDescription: 'Config, permissions, and live status',
    xPostTitle: 'Draft X post',
    xPostDescription: 'Pre-filled and confirm-ready',
    aiTitle: 'Ask Keepr AI',
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
  const tradeFlowHint = growthMode ? '3 taps -> vault, size, Accept' : '3 taps: vault -> size -> Accept'
  const xPostCommand = `/x post ${normalizeInlineDraft(normalizedQuery)} --confirm`
  const aiPrompt = normalizedQuery ? `/ai ${normalizedQuery}` : '/ai What should I do next?'
  const marketQuote = `/mkt quote ${inferMarketSymbol(normalizedQuery)}`
  const copy = buildCommonCopy(growthMode)
  const lowerQuery = normalizedQuery.toLowerCase()
  const wantsDeploy = queryClass === 'deploy' || /\b(deploy|launch|create)\b/.test(lowerQuery)
  const wantsStatus = /\b(status|health|permissions)\b/.test(lowerQuery)
  const wantsSocial = /\b(x|tweet|post)\b/.test(lowerQuery)
  const wantsAi = queryClass === 'ai'
  const wantsMarket = queryClass === 'market'

  const templates: InlineResultTemplate[] = []
  const pushTemplate = (template: InlineResultTemplate) => {
    templates.push(template)
  }

  if (tradeIntent) {
    const tradeCommand = tradeIntent.actionType === 'buy' ? '/buy' : tradeIntent.actionType === 'sell' ? '/sell' : '/bid'
    pushTemplate({
      key: 'trade-intent',
      title: growthMode ? `${tradeIntent.actionType.toUpperCase()} now -> guided` : `Start ${tradeIntent.actionType.toUpperCase()} now`,
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
  } else {
    pushTemplate({
      key: 'trade-quickstart',
      title: growthMode ? 'Buy now -> 3 taps' : 'Buy in 3 taps',
      description: tradeFlowHint,
      command: '/buy',
      baseScore: 100,
      intentTags: ['trade', 'general'],
      mediaKey: 'card:buy',
    })
    pushTemplate({
      key: 'portfolio',
      title: copy.portfolioTitle,
      description: copy.portfolioDescription,
      command: '/portfolio',
      baseScore: 86,
      intentTags: ['discovery', 'general'],
      mediaKey: 'card:portfolio',
    })
  }

  const sortedVaults = [...params.scopedVaults].sort((left, right) => left.vaultAddress.localeCompare(right.vaultAddress))
  for (let idx = 0; idx < sortedVaults.length; idx += 1) {
    const vault = sortedVaults[idx]
    const vaultAddress = asTrimmed(vault?.vaultAddress ?? '').toLowerCase()
    if (!isAddressLike(vaultAddress)) continue

    pushTemplate({
      key: `vault-buy-${idx}`,
      title: `Buy ${truncateAddress(vaultAddress)}`,
      description: tradeFlowHint,
      command: '/buy',
      baseScore: 92 - idx,
      intentTags: ['trade', 'discovery'],
      mediaKey: `vault:${vaultAddress}`,
    })

    if (isAddressLike(vault.ccaStrategyAddress) && !vault.isSettled) {
      pushTemplate({
        key: `vault-bid-${idx}`,
        title: `Bid ${truncateAddress(vaultAddress)}`,
        description: growthMode ? 'Auction flow -> ETH % sizing' : 'Auction mode with ETH % sizing',
        command: '/bid',
        baseScore: 90 - idx,
        intentTags: ['trade', 'discovery'],
        mediaKey: `vault:${vaultAddress}`,
      })
    }
  }

  pushTemplate({
    key: 'vaults',
    title: 'Browse vaults',
    description: 'See active vaults in this chat',
    command: '/vaults',
    baseScore: 80,
    intentTags: ['discovery', 'general'],
    mediaKey: 'card:vaults',
  })
  pushTemplate({
    key: 'auctions',
    title: 'Live auctions',
    description: 'Open active CCA auctions',
    command: '/auctions',
    baseScore: 79,
    intentTags: ['discovery', 'trade'],
    mediaKey: 'card:auctions',
  })
  pushTemplate({
    key: 'signals',
    title: 'Trade signals',
    description: 'Latest buy/sell events',
    command: '/signals',
    baseScore: 78,
    intentTags: ['discovery', 'trade'],
    mediaKey: 'card:signals',
  })
  pushTemplate({
    key: 'link-status',
    title: 'Link status',
    description: 'Check Telegram <-> wallet state',
    command: '/linked',
    baseScore: 74,
    intentTags: ['link', 'general'],
    mediaKey: 'card:linked',
  })
  pushTemplate({
    key: 'help',
    title: copy.helpTitle,
    description: copy.helpDescription,
    command: '/help',
    baseScore: 72,
    intentTags: ['general'],
    mediaKey: 'card:help',
  })
  // Keep inline discovery laser-focused on link + trade + portfolio.
  // Show advanced tools only when the user explicitly asks for them.
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
      title: 'Deploy your vault',
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
  return {
    results,
    offset,
    nextOffset,
    queryClass,
    totalResults,
    ...(shouldShowPmHandoff
      ? {
          button: {
            text: growthMode ? 'Link wallet to trade' : 'Link wallet',
            start_parameter: pmParameter,
          },
          switchPmText: growthMode ? 'Link wallet to trade' : 'Link wallet',
          switchPmParameter: pmParameter,
        }
      : {}),
  }
}
