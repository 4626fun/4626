import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'

declare const process: { env: Record<string, string | undefined> }

/**
 * Farcaster Frame for Content Coin / Creator Coin
 *
 * GET /api/frames/coin?address=0x...
 *
 * Returns an HTML page with Farcaster Frame meta tags for a Zora coin.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const address = typeof req.query.address === 'string' ? req.query.address : ''
  if (!address || !isAddress(address)) {
    return res.status(400).json({ error: 'Invalid coin address' })
  }

  const appUrl = (process.env.VITE_APP_URL ?? 'https://4626.fun').trim()
  const apiHost = (process.env.API_HOST ?? 'api.4626.fun').trim()
  const protocol = apiHost.includes('localhost') ? 'http' : 'https'

  // Try to fetch coin info for the title
  let coinName = 'Creator Coin'
  let coinSymbol = ''
  try {
    const { getCoin } = await import('@zoralabs/coins-sdk')
    const result = await getCoin({ address, chain: 8453 })
    const coin = (result as any)?.data?.zora?.coin
    if (coin?.name) coinName = coin.name
    if (coin?.symbol) coinSymbol = coin.symbol
  } catch {
    // Fallback to generic name
  }

  const title = coinSymbol ? `${coinName} ($${coinSymbol})` : coinName
  const imageUrl = `${protocol}://${apiHost}/v1/token/${address}/image`
  const coinUrl = `${appUrl}/coin/${address}`
  const tradeUrl = `https://zora.co/coin/base:${address}`

  const frameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Farcaster Frame Meta Tags -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />

  <!-- Button 1: View Coin -->
  <meta property="fc:frame:button:1" content="View Coin" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${coinUrl}" />

  <!-- Button 2: Trade on Zora -->
  <meta property="fc:frame:button:2" content="Trade on Zora" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${tradeUrl}" />

  <!-- Button 3: Buy via Keepr -->
  <meta property="fc:frame:button:3" content="Buy via Keepr" />
  <meta property="fc:frame:button:3:action" content="link" />
  <meta property="fc:frame:button:3:target" content="https://xmtp.chat/dm/${process.env.VITE_AGENT_XMTP_ADDRESS ?? ''}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${title} — CreatorVault" />
  <meta property="og:description" content="Trade ${title} on Base via CreatorVault" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${coinUrl}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} — CreatorVault" />
  <meta name="twitter:description" content="Trade ${title} on Base via CreatorVault" />
  <meta name="twitter:image" content="${imageUrl}" />

  <title>${title} — CreatorVault</title>
</head>
<body>
  <h1>${title}</h1>
  <p>Coin: ${address}</p>
  <p><a href="${coinUrl}">View Coin</a></p>
  <p><a href="${tradeUrl}">Trade on Zora</a></p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return res.status(200).send(frameHtml)
}
