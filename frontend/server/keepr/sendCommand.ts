import type { Address } from 'viem'
import { encodeFunctionData, parseUnits, isAddress, getAddress } from 'viem'

import { logger } from '../_lib/infra/logger.js'
import { BASE_CAIP2, walletRpc } from '../_lib/wallet/privyWalletApi.js'
import {
  buildInsufficientFundsRefusal,
  checkWalletBalancePreflight,
  getBasePreflightPublicClient,
  isInsufficientFundsError,
} from '../_lib/wallet/walletBalancePreflight.js'
import { assertTeeAttestationOrThrow } from '../_lib/agent/teeAttestationGate.js'
import { checkDurableRateLimit } from '../_lib/infra/durableRateLimit.js'
import { getDb, isDbConfigured } from '../_lib/db/postgres.js'
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

const BASE_CHAIN_ID = 8453

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
    await db.sql`
      CREATE TABLE IF NOT EXISTS keepr_send_daily_ledger (
        vault_address TEXT NOT NULL,
        token TEXT NOT NULL,
        day DATE NOT NULL,
        amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (vault_address, token, day)
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS keepr_send_daily_ledger_vault_day_idx
      ON keepr_send_daily_ledger (vault_address, day DESC);
    `
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

  try {
    await assertTeeAttestationOrThrow({
      action: 'keepr.send.transfer',
      actorAddress: params.senderWallet,
      metadata: {
        groupId: params.groupId,
        vaultAddress: params.vault.vaultAddress,
        token: parsed.token,
      },
    })
  } catch (err) {
    logger.warn('[send] TEE attestation gate denied send command', {
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      response: 'Transfer denied: secure signer attestation is not verified. Please retry once attestation is healthy.',
    }
  }

  // Look up agent wallet (Privy-managed, for onchain tx)
  // For CSW agents, the "agent wallet" IS the CSW — we use the Privy server
  // wallet to sign transactions that execute on the CSW.
  let agentWalletId: string
  let agentWalletAddress: string
  try {
    const { getOrCreateCreatorAgentWallet } = await import('../_lib/wallet/creatorAgentWallets.js')
    const wallet = await getOrCreateCreatorAgentWallet({ creatorToken: params.vault.creatorCoinAddress })
    agentWalletId = wallet.walletId
    agentWalletAddress = wallet.address
  } catch (err) {
    logger.error('[send] Failed to get agent wallet', err)
    return { ok: false, response: 'Agent wallet not available. Contact the vault creator.' }
  }

  let reservedDailySpend = false
  try {
    // Reserve daily limit first so successful transfers are always durably counted.
    await recordDailySpend(params.vault.vaultAddress, parsed.token, amountNum)
    reservedDailySpend = true
  } catch (err) {
    logger.error('[send] failed reserving durable daily spend', {
      groupId: params.groupId,
      vaultAddress: params.vault.vaultAddress,
      token: parsed.token,
      amount: amountNum,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      ok: false,
      response: 'Transfer unavailable: durable daily limits are temporarily unavailable. Please retry shortly.',
    }
  }

  // Defensive balance preflight: the Privy-managed agent EOA must cover
  // `value + gas`. For ETH transfers value = parsed amount; for ERC-20
  // transfers value = 0 (only gas matters). Fail-open on RPC errors.
  {
    const preflightValueWei = parsed.token === 'eth' ? parseUnits(parsed.amount, 18) : 0n
    let preflight: Awaited<ReturnType<typeof checkWalletBalancePreflight>> | null = null
    try {
      preflight = await checkWalletBalancePreflight({
        publicClient: getBasePreflightPublicClient(),
        wallet: agentWalletAddress as Address,
        valueWei: preflightValueWei,
      })
    } catch (error) {
      logger.warn('[send] balance preflight threw unexpectedly; proceeding', {
        groupId: params.groupId,
        wallet: agentWalletAddress,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    if (preflight && preflight.sufficient === false) {
      logger.warn('[send] agent wallet insufficient for transfer', {
        groupId: params.groupId,
        wallet: agentWalletAddress,
        token: parsed.token,
        balanceWei: preflight.balanceWei.toString(),
        requiredWei: preflight.requiredWei.toString(),
      })
      if (reservedDailySpend) {
        try {
          await recordDailySpend(params.vault.vaultAddress, parsed.token, -amountNum)
        } catch (rollbackError) {
          logger.error('[send] failed rolling back daily spend after preflight refusal', {
            groupId: params.groupId,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          })
        }
      }
      return { ok: false, response: preflight.message }
    }
  }

  try {
    let txHash: string

    if (parsed.token === 'eth') {
      // Native ETH transfer
      const valueWei = parseUnits(parsed.amount, 18)
      const result = await walletRpc<any>({
        walletId: agentWalletId,
        method: 'eth_sendTransaction',
        caip2: BASE_CAIP2,
        rpcParams: {
          transaction: {
            to: recipient,
            value: `0x${valueWei.toString(16)}`,
            chain_id: BASE_CHAIN_ID,
          },
        },
        idempotencyKey: `send:${params.groupId}:${Date.now()}`,
        teeContext: {
          action: 'keepr.send.transfer',
          actorAddress: params.senderWallet,
          metadata: {
            groupId: params.groupId,
            vaultAddress: params.vault.vaultAddress,
            token: parsed.token,
          },
        },
      })
      txHash = String(result?.data?.hash ?? result?.hash ?? 'pending')
    } else {
      // ERC-20 transfer
      const amountUnits = parseUnits(parsed.amount, tokenInfo.decimals)
      const data = encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [recipient, amountUnits],
      })
      const result = await walletRpc<any>({
        walletId: agentWalletId,
        method: 'eth_sendTransaction',
        caip2: BASE_CAIP2,
        rpcParams: {
          transaction: {
            to: tokenInfo.address,
            data,
            value: '0x0',
            chain_id: BASE_CHAIN_ID,
          },
        },
        idempotencyKey: `send:${params.groupId}:${Date.now()}`,
        teeContext: {
          action: 'keepr.send.transfer',
          actorAddress: params.senderWallet,
          metadata: {
            groupId: params.groupId,
            vaultAddress: params.vault.vaultAddress,
            token: parsed.token,
          },
        },
      })
      txHash = String(result?.data?.hash ?? result?.hash ?? 'pending')
    }

    logger.info('[send] Transfer sent', {
      groupId: params.groupId,
      token: tokenInfo.name,
      amount: parsed.amount,
      recipient,
      txHash,
      sender: params.senderWallet,
    })

    return {
      ok: true,
      response: [
        'Transfer sent',
        '',
        `- Amount: ${parsed.amount} ${tokenInfo.name}`,
        `- To: ${recipient}`,
        `- From: ${agentWalletAddress} (agent wallet)`,
        `- Tx: https://basescan.org/tx/${txHash}`,
        `- Requested by: ${params.senderWallet}`,
      ].join('\n'),
      action: {
        action: 'keepr.send.transfer',
        token: tokenInfo.name,
        amount: parsed.amount,
        recipient,
        txHash,
        agentWallet: agentWalletAddress,
        requestedBy: params.senderWallet,
        vaultAddress: params.vault.vaultAddress,
        groupId: params.groupId,
      },
    }
  } catch (err: any) {
    if (reservedDailySpend) {
      try {
        await recordDailySpend(params.vault.vaultAddress, parsed.token, -amountNum)
      } catch (rollbackError) {
        logger.error('[send] failed rolling back reserved daily spend', {
          groupId: params.groupId,
          vaultAddress: params.vault.vaultAddress,
          token: parsed.token,
          amount: amountNum,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        })
      }
    }
    // Map raw insufficient-funds errors that slipped past preflight
    // (e.g. preflight RPC failure, or gas estimation jumped above our buffer)
    // to the same friendly refusal so we never leak raw Privy 400s.
    if (isInsufficientFundsError(err)) {
      logger.warn('[send] walletRpc returned insufficient-funds after preflight', {
        groupId: params.groupId,
        wallet: agentWalletAddress,
        token: parsed.token,
        error: err?.message,
      })
      return {
        ok: false,
        response: buildInsufficientFundsRefusal({ balanceWei: 0n, requiredWei: 0n }),
      }
    }
    const msg = err?.message ?? 'Transaction failed'
    logger.error('[send] Transfer failed', { error: msg, groupId: params.groupId })
    return { ok: false, response: `Transfer failed: ${msg.slice(0, 200)}` }
  }
}
