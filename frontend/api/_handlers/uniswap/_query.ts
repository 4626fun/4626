import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Uniswap V4 Subgraph GraphQL Proxy
 * 
 * Proxies GraphQL queries to The Graph's decentralized network,
 * keeping the API key secure on the server side.
 */

// The Graph API key from environment
const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY || ''

// Uniswap V4 subgraph ID for Base
// Find at: https://thegraph.com/explorer/subgraphs
// Search for "uniswap v4 base"
const UNISWAP_V4_BASE_SUBGRAPH_ID = process.env.UNISWAP_V4_BASE_SUBGRAPH_ID || ''

// Fallback: Use a known V3 subgraph for Base if V4 isn't available yet
const UNISWAP_V3_BASE_SUBGRAPH_ID = '43Hwfi3dJSoGpyas9VwNoDAv55yjgGrPpNSmbQZArzMG'

function getSubgraphUrl(): string {
  const subgraphId = UNISWAP_V4_BASE_SUBGRAPH_ID || UNISWAP_V3_BASE_SUBGRAPH_ID
  if (!THEGRAPH_API_KEY || !subgraphId) {
    throw new Error('Missing THEGRAPH_API_KEY or subgraph ID')
  }
  return `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/${subgraphId}`
}

type GraphQLRequest = {
  query: string
  variables?: Record<string, unknown>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  // Check for required env vars
  if (!THEGRAPH_API_KEY) {
    console.error('Missing THEGRAPH_API_KEY environment variable')
    return res.status(503).json({
      success: false,
      error: 'Uniswap data service not configured',
      hint: 'Set THEGRAPH_API_KEY environment variable',
    })
  }

  try {
    const body = req.body as GraphQLRequest
    
    if (!body?.query || typeof body.query !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing GraphQL query' })
    }

    // Validate query is read-only (no mutations)
    const queryLower = body.query.toLowerCase()
    if (queryLower.includes('mutation') || queryLower.includes('subscription')) {
      return res.status(400).json({ success: false, error: 'Only queries are allowed' })
    }

    const subgraphUrl = getSubgraphUrl()
    
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: body.query,
        variables: body.variables || {},
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Subgraph error:', response.status, errorText)
      return res.status(response.status).json({
        success: false,
        error: `Subgraph error: ${response.status}`,
      })
    }

    const data = await response.json()
    
    // Return the GraphQL response as-is
    return res.status(200).json(data)
  } catch (error) {
    console.error('Uniswap query error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
