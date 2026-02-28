/**
 * Farcaster Auto-Cast — automatically posts casts for vault lifecycle events.
 *
 * Events:
 *   - vault.deployed   — New vault launched
 *   - vault.milestone  — TVL milestone reached
 *   - zora.coin.created — New Content Coin created
 *   - zora.coin.bought  — Coin purchased (opt-in via AUTOCAST_TRADES)
 *   - zora.coin.sold    — Coin sold (opt-in via AUTOCAST_TRADES)
 */

import { logger } from '../_lib/logger.js'
import { readNeynarApiKey } from '../_lib/neynarConfig.js'

declare const process: { env: Record<string, string | undefined> }

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

// ---------------------------------------------------------------------------
// Rate limiting — 1 auto-cast per event type per vault per hour
// ---------------------------------------------------------------------------

const autocastCooldowns = new Map<string, number>()
const AUTOCAST_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

function cooldownKey(vaultAddress: string, eventType: string): string {
  return `${vaultAddress.toLowerCase()}:${eventType}`
}

function canAutocast(vaultAddress: string, eventType: string): boolean {
  const key = cooldownKey(vaultAddress, eventType)
  const last = autocastCooldowns.get(key)
  if (!last) return true
  return Date.now() - last >= AUTOCAST_COOLDOWN_MS
}

function recordAutocast(vaultAddress: string, eventType: string) {
  autocastCooldowns.set(cooldownKey(vaultAddress, eventType), Date.now())
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type VaultEvent =
  | {
      type: 'vault.deployed'
      vaultAddress: string
      vaultName: string
      creatorName?: string
      creatorAddress: string
    }
  | {
      type: 'vault.milestone'
      vaultAddress: string
      vaultName: string
      milestone: string // e.g. "$10K TVL", "100 holders"
    }
  | {
      type: 'zora.coin.created'
      coinAddress: string
      name: string
      symbol: string
      currency: string
      creatorAddress: string
      vaultAddress?: string
    }
  | {
      type: 'zora.coin.bought'
      coinAddress: string
      ethAmount: string
      buyerAddress: string
      vaultAddress?: string
    }
  | {
      type: 'zora.coin.sold'
      coinAddress: string
      amount: string
      sellerAddress: string
      vaultAddress?: string
    }

// ---------------------------------------------------------------------------
// Cast formatting
// ---------------------------------------------------------------------------

function formatEventCast(event: VaultEvent): { text: string; embeds: Array<{ url: string }> } {
  const appUrl = (process.env.VITE_APP_URL ?? 'https://4626.fun').trim()

  switch (event.type) {
    case 'vault.deployed': {
      const creator = event.creatorName ?? event.creatorAddress.slice(0, 10)
      return {
        text: `New vault launched: ${event.vaultName} by ${creator}\n\nExplore it on 4626`,
        embeds: [{ url: `${appUrl}/vault/${event.vaultAddress}` }],
      }
    }

    case 'vault.milestone':
      return {
        text: `${event.vaultName} just hit ${event.milestone}!\n\nCheck it out on 4626`,
        embeds: [{ url: `${appUrl}/vault/${event.vaultAddress}` }],
      }

    case 'zora.coin.created':
      return {
        text: [
          `New content coin: ${event.name} ($${event.symbol})`,
          `Currency: ${event.currency}`,
          `\nCreated on Base via 4626`,
        ].join('\n'),
        embeds: [
          { url: `${appUrl}/coin/${event.coinAddress}` },
        ],
      }

    case 'zora.coin.bought':
      return {
        text: `Bought coin with ${event.ethAmount} ETH on Base via 4626`,
        embeds: [{ url: `${appUrl}/coin/${event.coinAddress}` }],
      }

    case 'zora.coin.sold':
      return {
        text: `Sold ${event.amount} tokens on Base via 4626`,
        embeds: [{ url: `${appUrl}/coin/${event.coinAddress}` }],
      }
  }
}

// ---------------------------------------------------------------------------
// Core auto-cast function
// ---------------------------------------------------------------------------

export async function autoCastVaultEvent(
  event: VaultEvent,
  options?: { channelId?: string },
): Promise<{ ok: true; hash: string } | { ok: false; reason: string }> {
  // Check if auto-casting is enabled for trade events
  const tradeEvents = ['zora.coin.bought', 'zora.coin.sold']
  if (tradeEvents.includes(event.type)) {
    const autocastTrades = (process.env.AUTOCAST_TRADES ?? 'false').trim().toLowerCase()
    if (autocastTrades !== 'true') {
      return { ok: false, reason: 'Trade auto-casting disabled (AUTOCAST_TRADES != true)' }
    }
  }

  // Rate limit check
  const vaultAddr = ('vaultAddress' in event ? event.vaultAddress : event.coinAddress) ?? 'global'
  if (!canAutocast(vaultAddr, event.type)) {
    return { ok: false, reason: `Rate limited: ${event.type} for ${vaultAddr}` }
  }

  // Get Neynar credentials
  const apiKey = readNeynarApiKey({ context: 'farcaster/autocast' })
  const signerUuid = (process.env.NEYNAR_SIGNER_UUID ?? '').trim()

  if (!apiKey || !signerUuid) {
    return { ok: false, reason: 'Neynar not configured (missing API key or signer UUID)' }
  }

  // Format the cast
  const { text, embeds } = formatEventCast(event)

  try {
    const body: Record<string, unknown> = {
      signer_uuid: signerUuid,
      text,
      embeds,
    }

    if (options?.channelId) {
      body.channel_id = options.channelId
    }

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
      logger.error('[autocast] Cast failed', { status: response.status, err: err.slice(0, 300) })
      return { ok: false, reason: `Neynar ${response.status}: ${err.slice(0, 200)}` }
    }

    const data = (await response.json()) as any
    const hash = String(data?.cast?.hash ?? data?.hash ?? 'unknown')

    recordAutocast(vaultAddr, event.type)

    logger.info('[autocast] Cast posted', {
      eventType: event.type,
      hash,
      vaultAddress: vaultAddr,
    })

    return { ok: true, hash }
  } catch (err: any) {
    logger.error('[autocast] Error posting cast', err)
    return { ok: false, reason: `Error: ${(err?.message ?? '').slice(0, 200)}` }
  }
}

/**
 * Fire-and-forget wrapper for auto-casting. Logs errors but never throws.
 */
export function fireAutocast(event: VaultEvent, options?: { channelId?: string }): void {
  void autoCastVaultEvent(event, options).catch((err) => {
    logger.error('[autocast] Unhandled error in fireAutocast', err)
  })
}
