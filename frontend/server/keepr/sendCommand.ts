import type { Address } from 'viem'
import { encodeFunctionData, parseUnits, isAddress, getAddress } from 'viem'

import { logger } from '../_lib/infra/logger.js'
import {
  resolveCommandIssuerContextByAddress,
  isExecutionReady,
} from '@4626/server-core'
import {
  isArchBSendViaUserOpEnabled,
  submitUserOpOrRefuse,
} from '../_lib/wallet/userOperationSubmitter.js'
import type { CoinbaseSmartWalletCall } from '../_lib/wallet/privyCoinbaseSmartWallet.js'
import { assertTeeAttestationOrThrow } from '../_lib/agent/teeAttestationGate.js'
import { checkDurableRateLimit } from '../_lib/infra/durableRateLimit.js'
import { getDb, isDbConfigured } from '../_lib/db/postgres.js'
import { ensureAgentRuntimeAuditLedgerSchema } from '../_lib/db/schemaBootstrap.js'
import type { KeeprVaultRow } from '../_lib/keepr/keeprRegistry.js'
import type { KeeprRole, KeeprCommandResult } from '../commands/types.js'

// ---------------------------------------------------------------------------
// Supported tokens on Base
// ---------------------------------------------------------------------------
const TOKENS: Record<string, { address: Address; decimals: number; name: string }> = {
  usdc: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    name: 'USDC',
  },
  eth: {
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    name: 'ETH',
  },
}

const ERC20_TRANSFER_ABI = [
  {
    type: 'function' as const,
    name: 'transfer' as const,
    inputs: [
      { name: 'to', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
    stateMutability: 'nonpayable' as const,
  },
]

type Db = {
  query?: (text: string, params?: any[]) => Promise<{ rows: any[] }>
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

// ---------------------------------------------------------------------------
// Rate limiting – one send per group per 60 s (durable)
// ---------------------------------------------------------------------------
const SEND_COOLDOWN_MS = 60_000

async function canSend(groupId: string): Promise<boolean> {
  const rl = await checkDurableRateLimit(`keepr:send:cooldown:${groupId}`, {
    windowMs: SEND_COOLDOWN_MS,
    maxRequests: 1,
  })
  return rl.allowed
}

// ---------------------------------------------------------------------------
// Transaction limits — per-vault daily caps and per-tx maximums
// ---------------------------------------------------------------------------
const PER_TX_MAX: Record<string, number> = { usdc: 1000, eth: 1 }
const DAILY_CAP: Record<string, number> = { usdc: 5000, eth: 5 }
const SEND_LIMIT_UNAVAILABLE_REASON = 'Durable daily limits are temporarily unavailable'

let sendLimitsSchemaEnsured = false

async function ensureSendLimitsSchema(db: Db): Promise<void> {
  if (sendLimitsSchemaEnsured) return
  try {
    await ensureAgentRuntimeAuditLedgerSchema(db as any)
    sendLimitsSchemaEnsured = true
  } catch (error) {
    sendLimitsSchemaEnsured = false
    logger.error('[send] failed to ensure durable send-limit schema', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('send_limit_schema_unavailable')
  }
}

async function getSendLimitDb(): Promise<Db> {
  if (!isDbConfigured()) throw new Error('send_limit_db_not_configured')
  const db = await getDb()
  if (!db) throw new Error('send_limit_db_unavailable')
  await ensureSendLimitsSchema(db as Db)
  return db as Db
}

async function getDailySpent(vaultAddress: string, token: string): Promise<number> {
  const db = await getSendLimitDb()
  try {
    const rows =
      typeof db.query === 'function'
        ? (
            await db.query(
              `SELECT amount
                 FROM keepr_send_daily_ledger
                WHERE vault_address = $1
                  AND token = $2
                  AND day = CURRENT_DATE
                LIMIT 1;`,
              [vaultAddress.toLowerCase(), token],
            )
          )?.rows
        : (
            await db.sql`
              SELECT amount
              FROM keepr_send_daily_ledger
              WHERE vault_address = ${vaultAddress.toLowerCase()}
                AND token = ${token}
                AND day = CURRENT_DATE
              LIMIT 1;
            `
          )?.rows
    const amount = Number(rows?.[0]?.amount ?? 0)
    if (Number.isFinite(amount) && amount >= 0) return amount
    throw new Error('send_limit_read_invalid_amount')
  } catch (error) {
    logger.error('[send] failed reading durable daily spend', {
      vaultAddress,
      token,
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('send_limit_read_failed')
  }
}

async function recordDailySpend(vaultAddress: string, token: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount === 0) return
  const db = await getSendLimitDb()
  try {
    if (typeof db.query === 'function') {
      await db.query(
        `INSERT INTO keepr_send_daily_ledger (vault_address, token, day, amount, updated_at)
         VALUES ($1, $2, CURRENT_DATE, $3, NOW())
         ON CONFLICT (vault_address, token, day)
         DO UPDATE SET amount = GREATEST(0, keepr_send_daily_ledger.amount + EXCLUDED.amount),
                       updated_at = NOW();`,
        [vaultAddress.toLowerCase(), token, amount],
      )
    } else {
      await db.sql`
        INSERT INTO keepr_send_daily_ledger (vault_address, token, day, amount, updated_at)
        VALUES (${vaultAddress.toLowerCase()}, ${token}, CURRENT_DATE, ${amount}, NOW())
        ON CONFLICT (vault_address, token, day)
        DO UPDATE SET amount = GREATEST(0, keepr_send_daily_ledger.amount + EXCLUDED.amount),
                      updated_at = NOW();
      `
    }
  } catch (error) {
    logger.error('[send] failed writing durable daily spend', {
      vaultAddress,
      token,
      amount,
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error('send_limit_write_failed')
  }
}

async function checkLimits(
  token: string,
  amount: number,
  vaultAddress: string,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const maxTx = PER_TX_MAX[token]
  if (maxTx !== undefined && amount > maxTx) {
    return { allowed: false, reason: `Max per transaction: ${maxTx} ${token.toUpperCase()}` }
  }
  const cap = DAILY_CAP[token]
  if (cap !== undefined) {
    let spent = 0
    try {
      spent = await getDailySpent(vaultAddress, token)
    } catch {
      return { allowed: false, reason: SEND_LIMIT_UNAVAILABLE_REASON }
    }
    if (spent + amount > cap) {
      const remaining = Math.max(0, cap - spent)
      return {
        allowed: false,
        reason: `Daily cap reached. Remaining today: ${remaining.toFixed(2)} ${token.toUpperCase()} (cap: ${cap})`,
      }
    }
  }
  return { allowed: true }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse: `/send <amount> <token> to <address>`
 *
 * Examples:
 *   /send 10 USDC to 0xabc...
 *   /send 0.5 ETH to 0xdef...
 *   send 100 usdc to 0x123...
 */
function parseSendCommand(text: string): { amount: string; token: string; recipient: string } | null {
  const cleaned = text.replace(/^\/?send\s+/i, '').trim()
  const match = cleaned.match(/^([\d.]+)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]{40})$/i)
  if (!match) return null
  return { amount: match[1], token: match[2].toLowerCase(), recipient: match[3] }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function handleSendCommand(params: {
  groupId: string
  senderWallet: Address
  text: string
  role: KeeprRole
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  // Permission check
  if (params.role === 'MEMBER') {
    return { ok: false, response: 'Denied: /send is ADMIN or OWNER only.' }
  }

  // Rate limit
  if (!(await canSend(params.groupId))) {
    return { ok: false, response: 'Rate limited. Wait 1 minute between sends.' }
  }

  // Parse the command
  const parsed = parseSendCommand(params.text)
  if (!parsed) {
    return {
      ok: false,
      response: [
        'Usage: /send <amount> <token> to <address>',
        '',
        'Examples:',
        '  /send 10 USDC to 0xabc...def',
        '  /send 0.5 ETH to 0xabc...def',
        '',
        `Supported tokens: ${Object.values(TOKENS).map((t) => t.name).join(', ')}`,
      ].join('\n'),
    }
  }

  // Validate token
  const tokenInfo = TOKENS[parsed.token]
  if (!tokenInfo) {
    return {
      ok: false,
      response: `Unsupported token: ${parsed.token.toUpperCase()}. Supported: ${Object.values(TOKENS).map((t) => t.name).join(', ')}`,
    }
  }

  // Validate amount
  const amountNum = Number(parsed.amount)
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return { ok: false, response: 'Invalid amount. Must be a positive number.' }
  }

  // Validate recipient
  if (!isAddress(parsed.recipient)) {
    return { ok: false, response: 'Invalid recipient address.' }
  }
  const recipient = getAddress(parsed.recipient) as Address

  // Check transaction limits
  const limitsCheck = await checkLimits(parsed.token, amountNum, params.vault.vaultAddress)
  if (!limitsCheck.allowed) {
    return { ok: false, response: `Limit exceeded: ${limitsCheck.reason}` }
  }

  // Keeper send routes through the issuer's parent CSW via UserOperation.
  // Per-coin Privy keeper EOAs are retired — no legacy EOA fallback.
  if (!isArchBSendViaUserOpEnabled()) {
    return {
      ok: false,
      response:
        "This trade can't be executed — enable ARCH_B_SEND_VIA_USEROP so /keepr send routes through your parent CSW. Per-coin agent EOAs are retired.",
    }
  }

  return await handleSendCommandViaArchB({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    recipient,
    parsed,
    tokenInfo,
    amountNum,
    vault: params.vault,
  })
}

// ---------------------------------------------------------------------------
// Architecture B — /keepr send via UserOperation on issuer's CSW.
// ---------------------------------------------------------------------------

async function handleSendCommandViaArchB(params: {
  groupId: string
  senderWallet: Address
  recipient: Address
  parsed: { amount: string; token: string; recipient: string }
  tokenInfo: { address: Address; decimals: number; name: string }
  amountNum: number
  vault: KeeprVaultRow
}): Promise<KeeprCommandResult> {
  // 1. Resolve the command issuer's execution context. Hard-fail if not
  //    provisioned or revoked — no fallback to the legacy EOA path.
  const resolution = await resolveCommandIssuerContextByAddress(params.senderWallet)
  if (!isExecutionReady(resolution)) {
    logger.warn('[send/arch-b] issuer not execution-ready; refusing', {
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      status: resolution.status,
    })
    if (resolution.status === 'db_unavailable') {
      return {
        ok: false,
        response:
          "This trade can't be executed right now — account readiness storage is temporarily unavailable. Please try again shortly.",
      }
    }
    if (resolution.status === 'revoked') {
      return {
        ok: false,
        response:
          "This trade can't be executed — your execution context has been revoked. Contact setup to restore access.",
      }
    }
    return {
      ok: false,
      response:
        "This trade can't be executed — your account isn't provisioned for onchain execution yet. Contact setup to finish provisioning.",
    }
  }
  const issuer = resolution.context

  // 2. TEE attestation gate (same as legacy path).
  try {
    await assertTeeAttestationOrThrow({
      action: 'keepr.send.transfer',
      actorAddress: params.senderWallet,
      metadata: {
        groupId: params.groupId,
        vaultAddress: params.vault.vaultAddress,
        token: params.parsed.token,
        archBPhase: 2,
      },
    })
  } catch (err) {
    logger.warn('[send/arch-b] TEE attestation gate denied send', {
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      response:
        'Transfer denied: secure signer attestation is not verified. Please retry once attestation is healthy.',
    }
  }

  // 3. Reserve vault-scoped legacy daily spend first. The submitter handles
  //    profile-scoped daily spend internally — keeping the vault ledger in
  //    sync preserves audit trails across both routing paths.
  let reservedLegacyDailySpend = false
  try {
    await recordDailySpend(params.vault.vaultAddress, params.parsed.token, params.amountNum)
    reservedLegacyDailySpend = true
  } catch (err) {
    logger.error('[send/arch-b] failed reserving legacy daily spend', {
      groupId: params.groupId,
      vaultAddress: params.vault.vaultAddress,
      token: params.parsed.token,
      amount: params.amountNum,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      response:
        'Transfer unavailable: durable daily limits are temporarily unavailable. Please retry shortly.',
    }
  }

  // 4. Build calls + native valueWei for caps/preflight.
  let calls: CoinbaseSmartWalletCall[]
  let nativeValueWei: bigint
  if (params.parsed.token === 'eth') {
    nativeValueWei = parseUnits(params.parsed.amount, 18)
    calls = [
      {
        to: params.recipient,
        value: nativeValueWei,
        data: '0x',
      },
    ]
  } else {
    nativeValueWei = 0n
    const amountUnits = parseUnits(params.parsed.amount, params.tokenInfo.decimals)
    const data = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [params.recipient, amountUnits],
    })
    calls = [
      {
        to: params.tokenInfo.address,
        value: 0n,
        data,
      },
    ]
  }

  // 5. Submit.
  const submission = await submitUserOpOrRefuse({
    issuer,
    calls,
    valueWei: nativeValueWei,
    correlationId: `send/arch-b:${params.groupId}`,
  })

  if (!submission.ok) {
    // Roll back the legacy vault ledger so a refused/failed submission
    // doesn't consume the vault's daily budget.
    if (reservedLegacyDailySpend) {
      try {
        await recordDailySpend(params.vault.vaultAddress, params.parsed.token, -params.amountNum)
      } catch (rollbackError) {
        logger.error('[send/arch-b] legacy daily-spend rollback failed', {
          groupId: params.groupId,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        })
      }
    }
    return { ok: false, response: submission.response }
  }

  logger.info('[send/arch-b] transfer sent via UserOp', {
    groupId: params.groupId,
    profileId: issuer.profileId,
    token: params.tokenInfo.name,
    amount: params.parsed.amount,
    recipient: params.recipient,
    smartWallet: submission.smartWallet,
    userOpHash: submission.userOpHash,
    txHash: submission.txHash,
    sender: params.senderWallet,
  })

  return {
    ok: true,
    response: [
      'Transfer sent',
      '',
      `- Amount: ${params.parsed.amount} ${params.tokenInfo.name}`,
      `- To: ${params.recipient}`,
      `- From: ${submission.smartWallet} (your smart wallet)`,
      `- Tx: https://basescan.org/tx/${submission.txHash}`,
      `- Requested by: ${params.senderWallet}`,
    ].join('\n'),
    action: {
      action: 'keepr.send.transfer',
      token: params.tokenInfo.name,
      amount: params.parsed.amount,
      recipient: params.recipient,
      txHash: submission.txHash,
      userOpHash: submission.userOpHash,
      smartWallet: submission.smartWallet,
      requestedBy: params.senderWallet,
      vaultAddress: params.vault.vaultAddress,
      groupId: params.groupId,
      routing: 'arch-b-userop',
    },
  }
}
