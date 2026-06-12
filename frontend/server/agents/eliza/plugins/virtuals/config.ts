/**
 * Virtuals ACP (Agent Commerce Protocol) plugin configuration.
 *
 * Connects the ElizaOS runtime to a Virtuals agent upgraded to ACP v2.
 * Credentials come from the agent's page on app.virtuals.io → Signers tab:
 *   - Wallet ID            → VIRTUALS_ACP_WALLET_ID
 *   - Signer private key   → VIRTUALS_ACP_SIGNER_PRIVATE_KEY (from "+ Add Signer")
 *   - Agent wallet address → VIRTUALS_ACP_WALLET_ADDRESS
 *
 * This is the Virtuals Protocol ACP (agent commerce / jobs), NOT the
 * ElizaOS-native Agent Client Protocol used for IDE/gateway integration.
 */

declare const process: { env: Record<string, string | undefined> }

export const VIRTUALS_ACP_DEFAULT_CHAIN_ID = 8453 // Base mainnet

const DEFAULT_MAX_BUDGET_USDC = 5
const DEFAULT_PERSONA =
  'You are the 4626 Virtuals agent. You provide services through ACP jobs honestly and concisely. ' +
  'Price work fairly, deliver exactly what the requirement asks for, and never promise capabilities you do not have.'

export type VirtualsAcpConfig = {
  enabled: boolean
  walletAddress: `0x${string}` | null
  walletId: string | null
  signerPrivateKey: string | null
  chainId: number
  persona: string
  /** Hard ceiling (USDC) applied to any LLM-chosen setBudget/fund amount. */
  maxBudgetUsdc: number
  /** When false (default), the LLM is never offered the `fund` tool — paying for jobs stays manual. */
  autoFundEnabled: boolean
  /** When false, the service only observes/logs job events; no LLM-driven tool execution. */
  autoLlmEnabled: boolean
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readOptionalString(name: string): string | null {
  const raw = String(process.env[name] ?? '').trim()
  return raw.length > 0 ? raw : null
}

function readPositiveNumber(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function normalizeAddressOrNull(value: string | null): `0x${string}` | null {
  if (!value) return null
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? (value.toLowerCase() as `0x${string}`) : null
}

export function readVirtualsAcpConfig(): VirtualsAcpConfig {
  return {
    enabled: readBool('VIRTUALS_ACP_ENABLED', false),
    walletAddress: normalizeAddressOrNull(readOptionalString('VIRTUALS_ACP_WALLET_ADDRESS')),
    walletId: readOptionalString('VIRTUALS_ACP_WALLET_ID'),
    signerPrivateKey: readOptionalString('VIRTUALS_ACP_SIGNER_PRIVATE_KEY'),
    chainId: Math.floor(readPositiveNumber('VIRTUALS_ACP_CHAIN_ID', VIRTUALS_ACP_DEFAULT_CHAIN_ID)),
    persona: readOptionalString('VIRTUALS_ACP_PERSONA') ?? DEFAULT_PERSONA,
    maxBudgetUsdc: readPositiveNumber('VIRTUALS_ACP_MAX_BUDGET_USDC', DEFAULT_MAX_BUDGET_USDC),
    autoFundEnabled: readBool('VIRTUALS_ACP_AUTO_FUND', false),
    autoLlmEnabled: readBool('VIRTUALS_ACP_AUTO_LLM', true),
  }
}

export type VirtualsAcpConfigCheck =
  | { ok: true; config: VirtualsAcpConfig }
  | { ok: false; reason: string }

export function checkVirtualsAcpConfig(config = readVirtualsAcpConfig()): VirtualsAcpConfigCheck {
  if (!config.enabled) return { ok: false, reason: 'disabled (set VIRTUALS_ACP_ENABLED=1)' }
  const missing: string[] = []
  if (!config.walletAddress) missing.push('VIRTUALS_ACP_WALLET_ADDRESS')
  if (!config.walletId) missing.push('VIRTUALS_ACP_WALLET_ID')
  if (!config.signerPrivateKey) missing.push('VIRTUALS_ACP_SIGNER_PRIVATE_KEY')
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `missing env: ${missing.join(', ')} (copy from app.virtuals.io agent page → Signers tab)`,
    }
  }
  return { ok: true, config }
}
