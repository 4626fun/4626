---
name: farcaster-agent
description: Farcaster social agent capabilities for 4626 - posting casts, frames, video galleries, and handling Farcaster-specific commands via the Keepr/XMTP agent stack. Use when the user mentions Farcaster, casts, frames, Warpcast, video galleries, social posting, or Neynar.
---

## Overview

This skill enables Farcaster social capabilities for the 4626 AI agent. It integrates with the existing Keepr/XMTP agent stack to:

1. Post casts (text, images, videos) to Farcaster
2. Create and serve Farcaster Frames
3. Handle Farcaster-specific commands in XMTP groups
4. Generate video gallery frames for promotional content

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Keepr/XMTP Agent                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ commands.ts │  │ farcaster/  │  │ creatorXmtpAgents   │  │
│  │ (keepr cmds)│  │ commands.ts │  │ (agent wallets)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Neynar API                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Cast        │  │ Frame       │  │ User Lookup         │  │
│  │ Publishing  │  │ Validation  │  │ (by address/fid)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Required Configuration

Environment variables (server-side only):

- `NEYNAR_API_KEY` - Neynar API key for Farcaster operations
- `NEYNAR_SIGNER_UUID` - Signer UUID for posting casts (per-agent or shared)
- `FARCASTER_DOMAIN` - Domain for SIWF (default: 4626.fun)

## Farcaster Commands

Available commands in XMTP groups (via Keepr agent):

### `/fc help`
Display available Farcaster commands.

### `/fc profile [address|fid|username]`
Look up a Farcaster profile.

### `/fc cast <message>`
Post a cast to Farcaster (requires ADMIN or OWNER role).

### `/fc gallery`
Generate a video gallery frame for the vault's promotional content.

### `/fc frame <url>`
Validate a Farcaster Frame URL.

## Video Gallery Support

When the agent needs to display video content, it returns structured JSON that the frontend can render:

```json
{
  "type": "video_gallery",
  "title": "Vault Highlights",
  "items": [
    {
      "src": "https://video.example.com/clip1.mp4",
      "aspectRatio": "16:9",
      "caption": "Launch Day",
      "autoplay": false,
      "muted": true,
      "loop": false,
      "controls": true
    }
  ]
}
```

### Video Gallery Guidelines

- Mobile autoplay requires: `muted: true`, `playsInline: true`
- Set aspect ratio explicitly (common: "16:9", "1:1", "3:2")
- For Twitter/X videos: may need proxying due to CORS/hotlinking
- Prefer self-hosted CDN copies for reliability

## Farcaster Frames

The agent can generate and serve Farcaster Frames for:

1. **Vault Info Frame** - Shows vault stats, TVL, APY
2. **Share Token Frame** - Displays token info with buy/trade actions
3. **Video Gallery Frame** - Embedded video content with social sharing
4. **Lottery Frame** - Current jackpot and entry status

Frame endpoints:

- `GET /api/frames/vault/:address` - Vault info frame
- `GET /api/frames/token/:address` - Token frame
- `GET /api/frames/gallery/:vaultAddress` - Video gallery frame
- `POST /api/frames/action` - Handle frame button actions

## Implementation Files

### Existing Infrastructure

- `frontend/server/farcaster/_shared.ts` - SIWF utilities
- `frontend/api/_handlers/social/_farcaster.ts` - Neynar profile lookup
- `frontend/api/_handlers/farcaster/*.ts` - SIWF authentication
- `frontend/src/lib/neynar-api.ts` - Client-side Farcaster API

### New Files to Create

- `frontend/server/farcaster/commands.ts` - Farcaster command handler
- `frontend/server/farcaster/cast.ts` - Cast publishing utilities
- `frontend/api/_handlers/farcaster/_cast.ts` - Cast posting endpoint
- `frontend/api/_handlers/frames/*.ts` - Frame serving endpoints

## Command Handler Template

```typescript
// frontend/server/farcaster/commands.ts
import type { Address } from 'viem'

export type FarcasterCommandResult =
  | { ok: true; response: string; action?: any }
  | { ok: false; response: string }

export async function handleFarcasterCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}): Promise<FarcasterCommandResult> {
  const raw = (params.text ?? '').trim()
  const prefix = raw.toLowerCase().startsWith('/fc') ? '/fc' : 
                 raw.toLowerCase().startsWith('fc') ? 'fc' : null
  if (!prefix) return { ok: false, response: '' }
  
  const parts = raw.split(/\s+/g).filter(Boolean)
  const cmd = parts[1]?.toLowerCase() ?? 'help'
  const args = parts.slice(2)
  
  switch (cmd) {
    case 'help':
      return { ok: true, response: formatHelp() }
    case 'profile':
      return await handleProfileLookup(args[0])
    case 'cast':
      if (params.role === 'MEMBER') {
        return { ok: false, response: 'Denied: ADMIN or OWNER only.' }
      }
      return await handleCastPost(args.join(' '), params.senderWallet)
    case 'gallery':
      return await handleGalleryGenerate(params.groupId)
    case 'frame':
      return await handleFrameValidate(args[0])
    default:
      return { ok: false, response: 'Unknown command. Try `/fc help`.' }
  }
}
```

## Cast Publishing Template

```typescript
// frontend/server/farcaster/cast.ts
declare const process: { env: Record<string, string | undefined> }

const NEYNAR_API_BASE = 'https://api.neynar.com/v2/farcaster'

export async function publishCast(params: {
  text: string
  signerUuid: string
  embeds?: Array<{ url: string }>
  replyTo?: string
}): Promise<{ hash: string } | { error: string }> {
  const apiKey = process.env.NEYNAR_API_KEY
  if (!apiKey) return { error: 'Neynar API not configured' }
  
  const response = await fetch(`${NEYNAR_API_BASE}/cast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      api_key: apiKey,
    },
    body: JSON.stringify({
      signer_uuid: params.signerUuid,
      text: params.text,
      embeds: params.embeds,
      parent: params.replyTo,
    }),
  })
  
  if (!response.ok) {
    const err = await response.text()
    return { error: `Cast failed: ${response.status} ${err}` }
  }
  
  const data = await response.json()
  return { hash: data.cast?.hash ?? data.hash }
}
```

## Frame Server Template

```typescript
// frontend/api/_handlers/frames/_vault.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { address } = req.query
  
  // Fetch vault data...
  const vaultData = { /* ... */ }
  
  const frameHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="https://api.4626.fun/v1/frames/vault/${address}/image" />
  <meta property="fc:frame:button:1" content="View Vault" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="https://4626.fun/vault/${address}" />
  <meta property="fc:frame:button:2" content="Buy Shares" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="https://4626.fun/vault/${address}?action=buy" />
  <meta property="og:title" content="${vaultData.name} Vault" />
  <meta property="og:image" content="https://api.4626.fun/v1/frames/vault/${address}/image" />
</head>
<body></body>
</html>`
  
  res.setHeader('Content-Type', 'text/html')
  return res.status(200).send(frameHtml)
}
```

## Integration with Keepr

To integrate Farcaster commands with the existing Keepr agent, update `frontend/server/keepr/commands.ts`:

```typescript
import { handleFarcasterCommand } from '../farcaster/commands.js'

// In handleKeeprCommand, add before the final return:
if (raw.toLowerCase().startsWith('/fc') || raw.toLowerCase().startsWith('fc ')) {
  return handleFarcasterCommand({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    text: raw,
    role,
  })
}
```

## Testing

1. **Profile Lookup**: `/fc profile vitalik.eth`
2. **Cast Posting**: `/fc cast Hello from 4626!`
3. **Frame Validation**: `/fc frame https://4626.fun/api/frames/vault/0x...`
4. **Gallery Generation**: `/fc gallery`

## Security Considerations

- Cast posting requires ADMIN or OWNER role
- Signer UUIDs should be per-creator or carefully managed
- Rate limit cast posting (1 per minute per group)
- Validate frame URLs before embedding
- Sanitize user input in cast text

## Troubleshooting

- "Neynar API error 401": Check `NEYNAR_API_KEY` is valid
- "Signer not found": Register signer via Neynar dashboard
- "Frame validation failed": Ensure frame meta tags are correct
- "Cast not appearing": Check Warpcast moderation status
