import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Uniswap V4 Subgraph GraphQL Proxy
 * 
 * Proxies GraphQL queries to The Graph's decentralized network,
 * keeping the API key secure on the server side.
 */

// The Graph API key from environment (supports both naming conventions)
const THEGRAPH_API_KEY = process.env.THEGRAPH_API_KEY || process.env.GRAPH_API_KEY || ''

// Custom 4626 subgraph for Zora coins on Uniswap V4 Base
// Owner: 0xakita.eth - https://thegraph.com/studio/subgraph/4626
// Deploy with: git clone https://github.com/Uniswap/v4-subgraph && yarn generate-subgraph base && graph deploy 4626
const CUSTOM_4626_SUBGRAPH_ID = 'Gqm2b5J85n1bhCyDMpGbtbVn4935EvvdyHdHrx3dibyj'

// Override via env var if needed
const UNISWAP_V4_BASE_SUBGRAPH_ID = process.env.UNISWAP_V4_BASE_SUBGRAPH_ID || CUSTOM_4626_SUBGRAPH_ID

function getSubgraphUrl(): string {
  if (!THEGRAPH_API_KEY || !UNISWAP_V4_BASE_SUBGRAPH_ID) {
    throw new Error('Missing THEGRAPH_API_KEY or UNISWAP_V4_BASE_SUBGRAPH_ID')
  }
  return `https://gateway.thegraph.com/api/${THEGRAPH_API_KEY}/subgraphs/id/${UNISWAP_V4_BASE_SUBGRAPH_ID}`
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
