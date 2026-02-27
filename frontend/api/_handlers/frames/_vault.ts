import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAddress } from 'viem'
import { handleOptions, setCors } from '../../server/auth/_shared.js'

declare const process: { env: Record<string, string | undefined> }

/**
 * Farcaster Frame for Vault Info
 * 
 * GET /api/frames/vault?address=0x...
 * 
 * Returns an HTML page with Farcaster Frame meta tags
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const address = typeof req.query.address === 'string' ? req.query.address : ''
  if (!address || !isAddress(address)) {
    return res.status(400).json({ error: 'Invalid vault address' })
  }

  const baseUrl = process.env.APP_HOST || 'app.4626.fun'
  const apiUrl = process.env.API_HOST || 'api.4626.fun'
  const protocol = baseUrl.includes('localhost') ? 'http' : 'https'

  // Frame image URL (uses token metadata image as fallback)
  const imageUrl = `${protocol}://${apiUrl}/v1/frames/vault/${address}/image`
  const vaultUrl = `${protocol}://${baseUrl}/vault/${address}`

  const frameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  
  <!-- Farcaster Frame Meta Tags -->
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${imageUrl}" />
  <meta property="fc:frame:image:aspect_ratio" content="1.91:1" />
  
  <!-- Button 1: View Vault -->
  <meta property="fc:frame:button:1" content="View Vault" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${vaultUrl}" />
  
  <!-- Button 2: Buy Shares -->
  <meta property="fc:frame:button:2" content="Buy Shares" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${vaultUrl}?action=buy" />
  
  <!-- Button 3: Trade on Uniswap -->
  <meta property="fc:frame:button:3" content="Trade" />
  <meta property="fc:frame:button:3:action" content="link" />
  <meta property="fc:frame:button:3:target" content="https://app.uniswap.org/swap?chain=base&outputCurrency=${address}" />
  
  <!-- Open Graph -->
  <meta property="og:title" content="4626" />
  <meta property="og:description" content="View vault details and buy shares" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${vaultUrl}" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="4626" />
  <meta name="twitter:description" content="View vault details and buy shares" />
  <meta name="twitter:image" content="${imageUrl}" />
  
  <title>4626 Frame</title>
</head>
<body>
  <h1>4626</h1>
  <p>Vault: ${address}</p>
  <p><a href="${vaultUrl}">View Vault</a></p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return res.status(200).send(frameHtml)
}
