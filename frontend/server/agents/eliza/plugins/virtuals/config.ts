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
export const VIRTUALS_ACP_DEFAULT_GLOBAL_TOOL_QUOTA = 100
export const VIRTUALS_ACP_DEFAULT_PER_JOB_TOOL_QUOTA = 10
const MAX_GLOBAL_TOOL_QUOTA = 1_000
const MAX_PER_JOB_TOOL_QUOTA = 100
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
  /** Deprecated compatibility flag. It never grants `fund` execution authority. */
  autoFundEnabled: boolean
  /** When false, the service only observes/logs job events; no LLM-driven tool execution. */
  autoLlmEnabled: boolean
  /** Mutating tools that may execute. Unlisted known tools remain proposals only. */
  executableHighRiskTools: VirtualsHighRiskTool[]
  /** Invalid entries retained so config validation cannot silently discard them. */
  invalidExecutableHighRiskTools: string[]
  /** Service-run cap across all ACP tool executions. */
  globalToolExecutionQuota: number
  /** Service-run cap for one chain/job pair. */
  perJobToolExecutionQuota: number
}

export const VIRTUALS_HIGH_RISK_TOOLS = ['setBudget', 'fund', 'submit', 'complete', 'reject'] as const
export type VirtualsHighRiskTool = (typeof VIRTUALS_HIGH_RISK_TOOLS)[number]
const HIGH_RISK_TOOL_SET = new Set<string>(VIRTUALS_HIGH_RISK_TOOLS)

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

function readBoundedInteger(name: string, fallback: number, maximum: number): number {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) return fallback
  return Math.min(value, maximum)
}

export function parseExecutableHighRiskTools(raw: string | null | undefined): VirtualsHighRiskTool[] {
  return [
    ...new Set(
      parseAllowlistValues(raw).filter(
        (value): value is VirtualsHighRiskTool => HIGH_RISK_TOOL_SET.has(value),
      ),
    ),
  ]
}

function parseAllowlistValues(raw: string | null | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function findInvalidExecutableHighRiskTools(raw: string | null | undefined): string[] {
  return [...new Set(parseAllowlistValues(raw).filter((value) => !HIGH_RISK_TOOL_SET.has(value)))]
}

const SECP256K1_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141')

export function isValidVirtualsSignerPrivateKey(value: string | null | undefined): boolean {
  const raw = String(value ?? '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/.test(raw)) return false
  const scalar = BigInt(raw)
  return scalar > 0n && scalar < SECP256K1_ORDER
}

function normalizeAddressOrNull(value: string | null): `0x${string}` | null {
  if (!value) return null
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? (value.toLowerCase() as `0x${string}`) : null
}

export function readVirtualsAcpConfig(): VirtualsAcpConfig {
  const executableHighRiskToolsRaw = readOptionalString(
    'VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS',
  )
  return {
    enabled: readBool('VIRTUALS_ACP_ENABLED', false),
    walletAddress: normalizeAddressOrNull(readOptionalString('VIRTUALS_ACP_WALLET_ADDRESS')),
    walletId: readOptionalString('VIRTUALS_ACP_WALLET_ID'),
    signerPrivateKey: readOptionalString('VIRTUALS_ACP_SIGNER_PRIVATE_KEY'),
    chainId: Math.floor(readPositiveNumber('VIRTUALS_ACP_CHAIN_ID', VIRTUALS_ACP_DEFAULT_CHAIN_ID)),
    persona: readOptionalString('VIRTUALS_ACP_PERSONA') ?? DEFAULT_PERSONA,
    maxBudgetUsdc: readPositiveNumber('VIRTUALS_ACP_MAX_BUDGET_USDC', DEFAULT_MAX_BUDGET_USDC),
    autoFundEnabled: readBool('VIRTUALS_ACP_AUTO_FUND', false),
    autoLlmEnabled: readBool('VIRTUALS_ACP_AUTO_LLM', false),
    executableHighRiskTools: parseExecutableHighRiskTools(executableHighRiskToolsRaw),
    invalidExecutableHighRiskTools: findInvalidExecutableHighRiskTools(
      executableHighRiskToolsRaw,
    ),
    globalToolExecutionQuota: readBoundedInteger(
      'VIRTUALS_ACP_GLOBAL_TOOL_EXECUTION_QUOTA',
      VIRTUALS_ACP_DEFAULT_GLOBAL_TOOL_QUOTA,
      MAX_GLOBAL_TOOL_QUOTA,
    ),
    perJobToolExecutionQuota: readBoundedInteger(
      'VIRTUALS_ACP_PER_JOB_TOOL_EXECUTION_QUOTA',
      VIRTUALS_ACP_DEFAULT_PER_JOB_TOOL_QUOTA,
      MAX_PER_JOB_TOOL_QUOTA,
    ),
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
  if (!isValidVirtualsSignerPrivateKey(config.signerPrivateKey)) {
    return {
      ok: false,
      reason: 'invalid VIRTUALS_ACP_SIGNER_PRIVATE_KEY (expected a non-zero 0x-prefixed 32-byte secp256k1 private key)',
    }
  }
  if (config.invalidExecutableHighRiskTools.length > 0) {
    return {
      ok: false,
      reason:
        'invalid VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS entries: ' +
        config.invalidExecutableHighRiskTools.join(', '),
    }
  }
  return { ok: true, config }
}
