import type { Address } from 'viem'
import { encodeFunctionData, parseUnits, isAddress, getAddress } from 'viem'

import { logger } from '../_lib/logger.js'
import { walletRpc } from '../_lib/privyWalletApi.js'
import { assertTeeAttestationOrThrow } from '../_lib/teeAttestationGate.js'
import type { KeeprVaultRow } from '../_lib/keeprRegistry.js'
import type { KeeprRole, KeeprCommandResult } from './commands.js'

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

// ---------------------------------------------------------------------------
// Rate limiting – one send per group per 60 s
// ---------------------------------------------------------------------------
const sendCooldowns = new Map<string, number>()
const SEND_COOLDOWN_MS = 60_000

function canSend(groupId: string): boolean {
  const last = sendCooldowns.get(groupId)
  if (!last) return true
  return Date.now() - last >= SEND_COOLDOWN_MS
}

function recordSend(groupId: string) {
  sendCooldowns.set(groupId, Date.now())
}

// ---------------------------------------------------------------------------
// Transaction limits — per-vault daily caps and per-tx maximums
// ---------------------------------------------------------------------------
const PER_TX_MAX: Record<string, number> = { usdc: 1000, eth: 1 }
const DAILY_CAP: Record<string, number> = { usdc: 5000, eth: 5 }

type DailyLedger = { date: string; totals: Record<string, number> }
const dailyLedgers = new Map<string, DailyLedger>()

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function getDailySpent(vaultAddress: string, token: string): number {
  const ledger = dailyLedgers.get(vaultAddress)
  if (!ledger || ledger.date !== todayKey()) return 0
  return ledger.totals[token] ?? 0
}

function recordDailySpend(vaultAddress: string, token: string, amount: number) {
  const today = todayKey()
  let ledger = dailyLedgers.get(vaultAddress)
  if (!ledger || ledger.date !== today) {
    ledger = { date: today, totals: {} }
    dailyLedgers.set(vaultAddress, ledger)
  }
  ledger.totals[token] = (ledger.totals[token] ?? 0) + amount
}

function checkLimits(
  token: string,
  amount: number,
  vaultAddress: string,
): { allowed: true } | { allowed: false; reason: string } {
  const maxTx = PER_TX_MAX[token]
  if (maxTx !== undefined && amount > maxTx) {
    return { allowed: false, reason: `Max per transaction: ${maxTx} ${token.toUpperCase()}` }
  }
  const cap = DAILY_CAP[token]
  if (cap !== undefined) {
    const spent = getDailySpent(vaultAddress, token)
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
  if (!canSend(params.groupId)) {
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
  const limitsCheck = checkLimits(parsed.token, amountNum, params.vault.vaultAddress)
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
    const { getOrCreateCreatorAgentWallet } = await import('../_lib/creatorAgentWallets.js')
    const wallet = await getOrCreateCreatorAgentWallet({ creatorToken: params.vault.creatorCoinAddress })
    agentWalletId = wallet.walletId
    agentWalletAddress = wallet.address
  } catch (err) {
    logger.error('[send] Failed to get agent wallet', err)
    return { ok: false, response: 'Agent wallet not available. Contact the vault creator.' }
  }

  try {
    recordSend(params.groupId)
    let txHash: string

    if (parsed.token === 'eth') {
      // Native ETH transfer
      const valueWei = parseUnits(parsed.amount, 18)
      const result = await walletRpc<any>({
        walletId: agentWalletId,
        method: 'eth_sendTransaction',
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

    recordDailySpend(params.vault.vaultAddress, parsed.token, amountNum)

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
    const msg = err?.message ?? 'Transaction failed'
    logger.error('[send] Transfer failed', { error: msg, groupId: params.groupId })
    return { ok: false, response: `Transfer failed: ${msg.slice(0, 200)}` }
  }
}
