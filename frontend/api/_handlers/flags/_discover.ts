import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'

declare const process: { env: Record<string, string | undefined> }

/**
 * Flag categories. Security and operational flags are env-only;
 * only `ui` flags are candidates for future remote targeting.
 */
type FlagCategory = 'security' | 'operational' | 'ui' | 'debug'

interface FlagDefinitionEntry {
  key: string
  description: string
  category: FlagCategory
  options: Array<{ value: unknown; label?: string }>
}

/**
 * Static flag definitions (server-safe mirror of the client registry).
 *
 * Values are NOT resolved here — the Toolbar reads values from the
 * FlagValues script tag rendered client-side. This endpoint only
 * exposes metadata so the Flags Explorer knows what flags exist.
 */
const FLAG_DEFINITIONS: FlagDefinitionEntry[] = [
  {
    key: 'privy-enabled',
    description: 'Master Privy client enablement — requires VITE_PRIVY_ENABLED + origin + host mode checks.',
    category: 'security',
    options: [{ value: false, label: 'Disabled' }, { value: true, label: 'Enabled' }],
  },
  {
    key: 'zora-migration-verify-implementation',
    description: 'Verify Zora coin implementation address against allowlist before migration.',
    category: 'security',
    options: [{ value: false, label: 'Skip verification' }, { value: true, label: 'Verify' }],
  },
  {
    key: 'host-mode',
    description: 'Active host mode — marketing (4626.fun) or app (app.4626.fun / localhost).',
    category: 'operational',
    options: [{ value: 'app', label: 'App' }, { value: 'marketing', label: 'Marketing' }],
  },
  {
    key: 'public-site-mode',
    description: 'When true, the app runs in read-only public/waitlist mode.',
    category: 'operational',
    options: [{ value: false, label: 'Normal' }, { value: true, label: 'Public' }],
  },
  {
    key: 'swap-provider',
    description: 'Active swap backend (uniswap, cdp, etc.).',
    category: 'operational',
    options: [{ value: 'uniswap', label: 'Uniswap' }, { value: 'cdp', label: 'CDP' }],
  },
  {
    key: 'injected-connector',
    description: 'Enable the browser-injected wallet connector in wagmi config.',
    category: 'operational',
    options: [{ value: false, label: 'Disabled' }, { value: true, label: 'Enabled' }],
  },
  {
    key: 'lens-grove',
    description: 'Show Lens Grove upload controls in profile and coin-manage surfaces.',
    category: 'ui',
    options: [{ value: false, label: 'Hidden' }, { value: true, label: 'Shown' }],
  },
  {
    key: 'debug-logs',
    description: 'Verbose console logging across logger, deploy, AA, and swap modules.',
    category: 'debug',
    options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
  },
  {
    key: 'xmtp-debug',
    description: 'Enable XMTP client debug logging.',
    category: 'debug',
    options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
  },
  {
    key: 'userop-telemetry',
    description: 'Emit ERC-4337 UserOp telemetry events.',
    category: 'debug',
    options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
  },
  {
    key: 'privy-analytics',
    description: 'Enable Privy browser analytics (disabled by default to reduce client-side noise).',
    category: 'debug',
    options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
  },
]

type DiscoverResponse = {
  definitions: Record<string, { options: Array<{ value: unknown; label?: string }>; description: string }>
  categories: Record<FlagCategory, string[]>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const definitions: DiscoverResponse['definitions'] = {}
  const categories: DiscoverResponse['categories'] = {
    security: [],
    operational: [],
    ui: [],
    debug: [],
  }

  for (const flag of FLAG_DEFINITIONS) {
    definitions[flag.key] = {
      options: flag.options,
      description: flag.description,
    }
    categories[flag.category].push(flag.key)
  }

  return res.status(200).json({
    success: true,
    data: { definitions, categories },
  } satisfies ApiEnvelope<DiscoverResponse>)
}
