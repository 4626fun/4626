import type { Address } from 'viem'
import { isAddress, getAddress } from 'viem'
import { logger } from '../_lib/logger.js'
import { readNeynarApiKey } from '../_lib/neynarConfig.js'

declare const process: { env: Record<string, string | undefined> }

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

export type FarcasterRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type FarcasterCommandResult =
  | { ok: true; response: string; action?: any; data?: any }
  | { ok: false; response: string }

// Rate limiting for cast posting
const castRateLimits = new Map<string, number>()
const CAST_COOLDOWN_MS = 60_000 // 1 minute

function canPostCast(groupId: string): boolean {
  const lastPost = castRateLimits.get(groupId)
  if (!lastPost) return true
  return Date.now() - lastPost >= CAST_COOLDOWN_MS
}

function recordCastPost(groupId: string) {
  castRateLimits.set(groupId, Date.now())
}

function formatHelp(): string {
  return [
    'Farcaster commands',
    '',
    '- /fc help - Show this help',
    '- /fc profile <address|fid|username> - Look up a profile',
    '- /fc cast <message> - Post a cast (ADMIN/OWNER)',
    '- /fc cast #channel <message> - Post to a channel (ADMIN/OWNER)',
    '- /fc channels <query> - Search Farcaster channels',
    '- /fc gallery - Generate video gallery for vault',
    '- /fc frame <url> - Validate a Farcaster Frame',
    '- /fc stats - Show Farcaster stats for vault creator',
  ].join('\n')
}

async function lookupProfile(query: string): Promise<FarcasterCommandResult> {
  const apiKey = readNeynarApiKey({ context: 'farcaster/lookupProfile' })
  if (!apiKey) {
    return { ok: false, response: 'Farcaster API not configured.' }
  }

  if (!query?.trim()) {
    return { ok: false, response: 'Usage: /fc profile <address|fid|username>' }
  }

  const trimmed = query.trim()
  let endpoint: string

  // Determine lookup type
  if (isAddress(trimmed)) {
    endpoint = `${NEYNAR_API_BASE}/user/bulk-by-address?addresses=${trimmed}`
  } else if (/^\d+$/.test(trimmed)) {
    endpoint = `${NEYNAR_API_BASE}/user/bulk?fids=${trimmed}`
  } else {
    // Username lookup
    endpoint = `${NEYNAR_API_BASE}/user/by_username?username=${encodeURIComponent(trimmed)}`
  }

  try {
    const response = await fetch(endpoint, {
      headers: { api_key: apiKey },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { ok: true, response: `Profile not found: ${trimmed}` }
      }
      return { ok: false, response: `Lookup failed: ${response.status}` }
    }

    const data = await response.json() as any
    
    // Parse response (varies by endpoint)
    let user: any = null
    if (isAddress(trimmed)) {
      const map = data ?? {}
      const key = Object.keys(map)[0]
      user = key && Array.isArray(map[key]) ? map[key][0] : null
    } else if (/^\d+$/.test(trimmed)) {
      user = Array.isArray(data?.users) ? data.users[0] : null
    } else {
      user = data?.user ?? null
    }

    if (!user) {
      return { ok: true, response: `Profile not found: ${trimmed}` }
    }

    const lines = [
      `Farcaster Profile: @${user.username}`,
      '',
      `- FID: ${user.fid}`,
      `- Display: ${user.display_name || 'n/a'}`,
      `- Followers: ${user.follower_count ?? 0}`,
      `- Following: ${user.following_count ?? 0}`,
      `- Power Badge: ${user.power_badge ? 'yes' : 'no'}`,
      `- Custody: ${user.custody_address || 'n/a'}`,
    ]

    if (Array.isArray(user.verifications) && user.verifications.length > 0) {
      lines.push(`- Verified: ${user.verifications.slice(0, 3).join(', ')}`)
    }

    lines.push(`- URL: https://warpcast.com/${user.username}`)

    return { ok: true, response: lines.join('\n'), data: user }
  } catch (error) {
    logger.error('[fc/profile] Lookup error:', error)
    return { ok: false, response: 'Profile lookup failed.' }
  }
}

async function postCast(params: {
  text: string
  senderWallet: Address
  groupId: string
  replyTo?: string
  embeds?: Array<{ url: string }>
  channelId?: string
}): Promise<FarcasterCommandResult> {
  const apiKey = readNeynarApiKey({ context: 'farcaster/postCast' })
  const signerUuid = process.env.NEYNAR_SIGNER_UUID

  if (!apiKey || !signerUuid) {
    return { ok: false, response: 'Farcaster posting not configured. Set NEYNAR_API_KEY and NEYNAR_SIGNER_UUID.' }
  }

  if (!params.text?.trim()) {
    return { ok: false, response: 'Usage: /fc cast <message>' }
  }

  if (!canPostCast(params.groupId)) {
    return { ok: false, response: 'Rate limited. Wait 1 minute between casts.' }
  }

  const castText = params.text.trim()
  if (castText.length > 1024) {
    return { ok: false, response: 'Cast too long. Max 1024 characters.' }
  }

  try {
    const body: Record<string, unknown> = {
      signer_uuid: signerUuid,
      text: castText,
    }

    if (params.replyTo) body.parent = params.replyTo
    if (params.embeds && params.embeds.length > 0) body.embeds = params.embeds
    if (params.channelId) body.channel_id = params.channelId

    const response = await fetch(`${NEYNAR_API_BASE}/cast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        api_key: apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      logger.error('[fc/cast] Post failed:', { status: response.status, err })
      return { ok: false, response: `Cast failed: ${response.status}` }
    }

    const data = await response.json() as any
    const hash = data?.cast?.hash ?? data?.hash ?? 'unknown'
    recordCastPost(params.groupId)

    const channelInfo = params.channelId ? `\n- Channel: #${params.channelId}` : ''
    const replyInfo = params.replyTo ? `\n- Reply to: ${params.replyTo}` : ''

    return {
      ok: true,
      response: `Cast posted!\n- Hash: ${hash}${channelInfo}${replyInfo}\n- View: https://warpcast.com/~/conversations/${hash}`,
      action: {
        action: 'farcaster.cast.posted',
        hash,
        text: castText,
        channelId: params.channelId,
        replyTo: params.replyTo,
        actor: params.senderWallet,
      },
    }
  } catch (error) {
    logger.error('[fc/cast] Post error:', error)
    return { ok: false, response: 'Failed to post cast.' }
  }
}

async function generateGallery(groupId: string): Promise<FarcasterCommandResult> {
  // Generate a video gallery JSON for the vault
  // In a real implementation, this would fetch vault-specific media
  
  const gallery = {
    type: 'video_gallery',
    title: 'Vault Highlights',
    items: [
      {
        src: 'https://4626.fun/videos/intro.mp4',
        aspectRatio: '16:9',
        caption: 'Welcome to CreatorVault',
        autoplay: false,
        muted: true,
        loop: false,
        controls: true,
      },
    ],
  }

  return {
    ok: true,
    response: [
      'Video Gallery Generated',
      '',
      'Use this JSON in your UI:',
      '',
      '```json',
      JSON.stringify(gallery, null, 2),
      '```',
      '',
      'Or share the frame URL:',
      `https://4626.fun/api/frames/gallery/${groupId}`,
    ].join('\n'),
    data: gallery,
  }
}

async function validateFrame(url: string): Promise<FarcasterCommandResult> {
  if (!url?.trim()) {
    return { ok: false, response: 'Usage: /fc frame <url>' }
  }

  const trimmed = url.trim()
  
  // Basic URL validation
  try {
    new URL(trimmed)
  } catch {
    return { ok: false, response: 'Invalid URL format.' }
  }

  // Fetch and check for frame meta tags
  try {
    const response = await fetch(trimmed, {
      headers: { 'User-Agent': 'Farcaster Frame Validator' },
    })

    if (!response.ok) {
      return { ok: false, response: `Frame URL returned ${response.status}` }
    }

    const html = await response.text()
    
    // Check for required frame meta tags
    const hasFrameVersion = html.includes('fc:frame') && html.includes('vNext')
    const hasImage = html.includes('fc:frame:image')
    const hasButton = html.includes('fc:frame:button')

    const lines = [
      'Frame Validation',
      '',
      `- URL: ${trimmed}`,
      `- fc:frame version: ${hasFrameVersion ? 'yes' : 'MISSING'}`,
      `- fc:frame:image: ${hasImage ? 'yes' : 'MISSING'}`,
      `- fc:frame:button: ${hasButton ? 'yes' : 'none'}`,
      '',
      hasFrameVersion && hasImage
        ? 'Frame appears valid.'
        : 'Frame is missing required tags.',
    ]

    return { ok: true, response: lines.join('\n') }
  } catch (error) {
    logger.error('[fc/frame] Validation error:', error)
    return { ok: false, response: 'Failed to fetch frame URL.' }
  }
}

async function getCreatorStats(senderWallet: Address): Promise<FarcasterCommandResult> {
  const apiKey = readNeynarApiKey({ context: 'farcaster/getCreatorStats' })
  if (!apiKey) {
    return { ok: false, response: 'Farcaster API not configured.' }
  }

  try {
    // Look up the sender's Farcaster profile
    const response = await fetch(
      `${NEYNAR_API_BASE}/user/bulk-by-address?addresses=${senderWallet}`,
      { headers: { api_key: apiKey } }
    )

    if (!response.ok) {
      return { ok: false, response: 'Could not fetch Farcaster stats.' }
    }

    const data = await response.json() as any
    const key = Object.keys(data)[0]
    const user = key && Array.isArray(data[key]) ? data[key][0] : null

    if (!user) {
      return {
        ok: true,
        response: [
          'Farcaster Stats',
          '',
          `- Wallet: ${senderWallet}`,
          '- Status: No Farcaster account linked',
          '',
          'Link your wallet on Warpcast to show stats here.',
        ].join('\n'),
      }
    }

    return {
      ok: true,
      response: [
        'Farcaster Stats',
        '',
        `- Username: @${user.username}`,
        `- FID: ${user.fid}`,
        `- Followers: ${user.follower_count ?? 0}`,
        `- Following: ${user.following_count ?? 0}`,
        `- Power Badge: ${user.power_badge ? 'yes' : 'no'}`,
        `- Profile: https://warpcast.com/${user.username}`,
      ].join('\n'),
      data: user,
    }
  } catch (error) {
    logger.error('[fc/stats] Stats error:', error)
    return { ok: false, response: 'Failed to fetch Farcaster stats.' }
  }
}

// ---------------------------------------------------------------------------
// /fc channels — search Farcaster channels
// ---------------------------------------------------------------------------

async function searchChannels(query: string): Promise<FarcasterCommandResult> {
  const apiKey = readNeynarApiKey({ context: 'farcaster/searchChannels' })
  if (!apiKey) {
    return { ok: false, response: 'Farcaster API not configured.' }
  }

  if (!query?.trim()) {
    return { ok: false, response: 'Usage: /fc channels <search query>' }
  }

  try {
    const response = await fetch(
      `${NEYNAR_API_BASE}/channel/search?q=${encodeURIComponent(query.trim())}&limit=10`,
      { headers: { api_key: apiKey } },
    )

    if (!response.ok) {
      return { ok: false, response: `Channel search failed: ${response.status}` }
    }

    const data = (await response.json()) as any
    const channels = data?.channels ?? []

    if (channels.length === 0) {
      return { ok: true, response: `No channels found for "${query}".` }
    }

    const lines = [
      `Farcaster Channels matching "${query}"`,
      '',
      ...channels.slice(0, 10).map((ch: any) => {
        const followers = ch.follower_count ?? 0
        return `- #${ch.id} — ${ch.name ?? ch.id} (${followers} followers)`
      }),
      '',
      'Use: /fc cast #channel-id <message>',
    ]

    return { ok: true, response: lines.join('\n') }
  } catch (error) {
    logger.error('[fc/channels] Search error:', error)
    return { ok: false, response: 'Channel search failed.' }
  }
}

/**
 * Handle Farcaster commands from XMTP/Keepr groups
 */
export async function handleFarcasterCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: FarcasterRole
}): Promise<FarcasterCommandResult> {
  const raw = (params.text ?? '').trim()
  
  // Check for /fc or fc prefix
  const looksLikeFc = raw.toLowerCase().startsWith('/fc') || raw.toLowerCase().startsWith('fc ')
  if (!looksLikeFc) {
    return { ok: false, response: '' }
  }

  const parts = raw.split(/\s+/g).filter(Boolean)
  const prefix = parts[0]?.toLowerCase()
  const cmd = (prefix === '/fc' || prefix === 'fc') ? (parts[1]?.toLowerCase() ?? 'help') : 'help'
  const args = parts.slice(2)

  logger.info('[fc/command]', { groupId: params.groupId, cmd, role: params.role })

  switch (cmd) {
    case 'help':
      return { ok: true, response: formatHelp() }

    case 'profile':
      return await lookupProfile(args[0] ?? '')

    case 'cast': {
      if (params.role === 'MEMBER') {
        return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
      }

      // Check for #channel prefix: /fc cast #channel-name <message>
      let channelId: string | undefined
      let castArgs = args

      if (args[0]?.startsWith('#')) {
        channelId = args[0].slice(1) // remove #
        castArgs = args.slice(1)
      }

      return await postCast({
        text: castArgs.join(' '),
        senderWallet: params.senderWallet,
        groupId: params.groupId,
        channelId,
      })
    }

    case 'channels':
      return await searchChannels(args.join(' '))

    case 'gallery':
      return await generateGallery(params.groupId)

    case 'frame':
      return await validateFrame(args[0] ?? '')

    case 'stats':
      return await getCreatorStats(params.senderWallet)

    default:
      return { ok: false, response: `Unknown command: ${cmd}. Try \`/fc help\`.` }
  }
}
