import type { Action, Content, HandlerCallback, IAgentRuntime, Memory, Plugin, State } from '@elizaos/core'

type OpenClawBridgeResult = {
  success: boolean
  data?: any
  error?: string
}

function getBridgeOrigin(): string {
  return (
    (process.env.OPENCLAW_BRIDGE_ORIGIN ?? '').trim() ||
    (process.env.CANONICAL_ORIGIN ?? '').trim() ||
    'https://4626.fun'
  )
}

function parseAddressFromText(text: string): string | null {
  const match = text.match(/0x[a-fA-F0-9]{40}/)
  return match ? match[0] : null
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false
  }
  return fallback
}

async function callBridge(tool: string, input: Record<string, unknown>): Promise<any> {
  const origin = getBridgeOrigin()
  const res = await fetch(`${origin}/api/openclaw/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  })
  const json = (await res.json().catch(() => null)) as OpenClawBridgeResult | null
  if (!res.ok || !json?.success) {
    const msg = json?.error || `Bridge request failed (${res.status})`
    throw new Error(msg)
  }
  return json.data
}

async function respond(callback: HandlerCallback | undefined, data: any) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  await callback?.({ text } as Content)
}

const lensMappingAction: Action = {
  name: 'LENS_MAPPING',
  similes: ['lens mapping', 'lens resolve', 'resolve lens'],
  description: 'Resolve a wallet to its canonical Lens profile mapping.',
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/lens mapping') || text.startsWith('/lens resolve')
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const fromOptions = typeof options?.address === 'string' ? options.address : null
    const fromText = parseAddressFromText(message.content?.text ?? '')
    const address = fromOptions ?? fromText
    if (!address) {
      await respond(callback, 'Missing address. Provide a wallet address.')
      return
    }
    const store = parseBoolean(options?.store, true)
    const data = await callBridge('lens_mapping', { address, store })
    await respond(callback, data)
  },
}

const lensGraphAction: Action = {
  name: 'LENS_GRAPH',
  similes: ['lens graph', 'lens network'],
  description: 'Generate a Lens identity graph for a wallet.',
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/lens graph') || text.startsWith('/lens network')
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const fromOptions = typeof options?.address === 'string' ? options.address : null
    const fromText = parseAddressFromText(message.content?.text ?? '')
    const address = fromOptions ?? fromText
    if (!address) {
      await respond(callback, 'Missing address. Provide a wallet address.')
      return
    }
    const store = parseBoolean(options?.store, true)
    const data = await callBridge('lens_graph', { address, store })
    await respond(callback, data)
  },
}

const shareTokenMetadataAction: Action = {
  name: 'SHARE_TOKEN_METADATA',
  similes: ['share token metadata', 'shareoft metadata'],
  description: 'Generate Grove-backed ShareOFT metadata for a token address.',
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content?.text ?? '').trim().toLowerCase()
    return text.startsWith('/share metadata') || text.startsWith('/shareoft metadata')
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback,
  ) => {
    const fromOptions = typeof options?.address === 'string' ? options.address : null
    const fromText = parseAddressFromText(message.content?.text ?? '')
    const address = fromOptions ?? fromText
    if (!address) {
      await respond(callback, 'Missing address. Provide a ShareOFT address.')
      return
    }
    const store = parseBoolean(options?.store, true)
    const chainId = typeof options?.chainId === 'number' ? options.chainId : undefined
    const data = await callBridge('share_token_metadata', { address, store, chainId })
    await respond(callback, data)
  },
}

export const lensPlugin: Plugin = {
  name: 'creatorvault-lens',
  description: 'Lens mapping and graph tools for CreatorVault.',
  actions: [lensMappingAction, lensGraphAction, shareTokenMetadataAction],
}
