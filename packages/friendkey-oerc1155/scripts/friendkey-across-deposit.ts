#!/usr/bin/env tsx
/**
 * FriendKey (multi-id): Robinhood USDG → Base FriendKeyBuyExecutor via Across depositV3
 * with tightened exclusive-relayer window.
 *
 * Message: abi.encode(recipient, tokenId, keyAmount) — defaults tokenId=1659, keys=1.
 *
 *   pnpm buy -- --dry-run
 *   pnpm buy -- --execute --confirm=FRIENDKEY-ACROSS-DEPOSIT
 *
 * Env:
 *   PRIVATE_KEY / ROBINHOOD_RPC_URL / BASE_RPC_URL
 *   FRIENDKEY_BUY_EXECUTOR / FRIENDKEY_TOKEN_ID / FRIENDKEY_ACROSS_MIN_EXCLUSIVITY_SEC
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  http,
  isAddress,
  maxUint256,
  parseAbi,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import {
  FRIENDKEY_ACROSS_MIN_EXCLUSIVITY_SEC,
  resolveAcrossExclusivityParameter,
} from './lib/exclusivity.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = resolve(__dirname, '..')

const RH_CHAIN_ID = 4663
const BASE_CHAIN_ID = 8453
/** Multi-id FriendKeyBuyExecutor (FriendKeyOERC1155 stack). Legacy #1659-only: 0x5B6b…28BA */
const DEFAULT_BUY_EXECUTOR = '0x157aFfd665C81a72579762EaEEe00070B1327Ab4' as const
const DEFAULT_USDG = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168' as const
const DEFAULT_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
const DEFAULT_FRIEND_KEY = '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F' as const
const DEFAULT_TOKEN_ID = 1659n
const DEFAULT_RH_RPC = 'https://rpc.mainnet.chain.robinhood.com'
const ACROSS_FEES_URL = 'https://across.to/api/suggested-fees'

const spokePoolAbi = parseAbi([
  'function depositV3(address depositor,address recipient,address inputToken,address outputToken,uint256 inputAmount,uint256 outputAmount,uint256 destinationChainId,address exclusiveRelayer,uint32 quoteTimestamp,uint32 fillDeadline,uint32 exclusivityDeadline,bytes message)',
])

const friendKeyAbi = parseAbi([
  'function getBuyPriceAfterFee(uint256 id,uint256 amount) view returns (uint256)',
])

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(PKG_ROOT, '.env.local'))
loadEnvFile(resolve(PKG_ROOT, '.env'))

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function getArg(name: string, fallback = ''): string {
  const eqPrefix = `${name}=`
  for (const arg of process.argv) {
    if (arg.startsWith(eqPrefix)) return arg.slice(eqPrefix.length).trim()
  }
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function requireAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`Invalid ${label}: ${value}`)
  return getAddress(value)
}

function requirePrivateKey(): Hex {
  const raw = (process.env.PRIVATE_KEY || '').trim()
  if (!raw) throw new Error('PRIVATE_KEY required for --execute')
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex
}

type SuggestedFees = {
  timestamp: string | number
  fillDeadline: string | number
  exclusivityDeadline: string | number
  exclusiveRelayer: string
  outputAmount: string | number
  spokePoolAddress: string
  estimatedFillTimeSec?: number
  totalRelayFee?: { total?: string }
}

async function fetchSuggestedFees(params: {
  inputToken: Address
  outputToken: Address
  amount: bigint
  recipient: Address
  message: Hex
}): Promise<SuggestedFees> {
  const url = new URL(ACROSS_FEES_URL)
  url.searchParams.set('inputToken', params.inputToken)
  url.searchParams.set('outputToken', params.outputToken)
  url.searchParams.set('originChainId', String(RH_CHAIN_ID))
  url.searchParams.set('destinationChainId', String(BASE_CHAIN_ID))
  url.searchParams.set('amount', params.amount.toString())
  url.searchParams.set('recipient', params.recipient)
  url.searchParams.set('message', params.message)

  const res = await fetch(url)
  const body = (await res.json()) as SuggestedFees & { message?: string; type?: string }
  if (!res.ok || (body as { type?: string }).type === 'AcrossApiError') {
    throw new Error(`suggested-fees failed: ${JSON.stringify(body)}`)
  }
  return body
}

async function main(): Promise<void> {
  const dryRun = hasFlag('--dry-run') || !hasFlag('--execute')
  const execute = hasFlag('--execute')
  if (execute && getArg('--confirm') !== 'FRIENDKEY-ACROSS-DEPOSIT') {
    throw new Error('Refusing --execute without --confirm=FRIENDKEY-ACROSS-DEPOSIT')
  }

  const keyAmount = BigInt(getArg('--keys', '1'))
  if (keyAmount <= 0n) throw new Error('--keys must be > 0')
  const tokenId = BigInt(getArg('--token-id', process.env.FRIENDKEY_TOKEN_ID || DEFAULT_TOKEN_ID.toString()))
  if (tokenId < 0n) throw new Error('--token-id must be >= 0')

  const buyExecutor = requireAddress(
    getArg('--executor', process.env.FRIENDKEY_BUY_EXECUTOR || DEFAULT_BUY_EXECUTOR),
    'executor',
  )
  const usdg = requireAddress(getArg('--usdg', DEFAULT_USDG), 'usdg')
  const usdc = requireAddress(getArg('--usdc', DEFAULT_USDC), 'usdc')
  const friendKey = requireAddress(getArg('--friend-key', DEFAULT_FRIEND_KEY), 'friend-key')
  const minExclusivitySec = Number(
    getArg(
      '--min-exclusivity-sec',
      process.env.FRIENDKEY_ACROSS_MIN_EXCLUSIVITY_SEC || String(FRIENDKEY_ACROSS_MIN_EXCLUSIVITY_SEC),
    ),
  )
  if (!Number.isFinite(minExclusivitySec) || minExclusivitySec < 1 || minExclusivitySec > 31_536_000) {
    throw new Error('invalid --min-exclusivity-sec (expected 1..31536000)')
  }

  const rhRpc = process.env.ROBINHOOD_RPC_URL?.trim() || DEFAULT_RH_RPC
  const baseRpc = process.env.BASE_RPC_URL?.trim()
  if (!baseRpc) throw new Error('BASE_RPC_URL required')

  const robinhood = {
    id: RH_CHAIN_ID,
    name: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rhRpc] } },
  } as const
  const base = {
    id: BASE_CHAIN_ID,
    name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [baseRpc] } },
  } as const

  const rhPublic = createPublicClient({ chain: robinhood, transport: http(rhRpc) })
  const basePublic = createPublicClient({ chain: base, transport: http(baseRpc) })

  const account = execute ? privateKeyToAccount(requirePrivateKey()) : null
  const recipient = requireAddress(
    getArg(
      '--recipient',
      account?.address ||
        process.env.FRIENDKEY_RECIPIENT ||
        '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
    ),
    'recipient',
  )

  const price = await basePublic.readContract({
    address: friendKey,
    abi: friendKeyAbi,
    functionName: 'getBuyPriceAfterFee',
    args: [tokenId, keyAmount],
  })
  const bufferBps = BigInt(getArg('--buffer-bps', '2000')) // 20% default
  const inputAmount =
    getArg('--amount') !== ''
      ? BigInt(getArg('--amount'))
      : (price * (10_000n + bufferBps)) / 10_000n

  // FriendKeyBuyExecutor: abi.encode(recipient, tokenId, keyAmount)
  const message = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
    ],
    [recipient, tokenId, keyAmount],
  )

  const fees = await fetchSuggestedFees({
    inputToken: usdg,
    outputToken: usdc,
    amount: inputAmount,
    recipient: buyExecutor,
    message,
  })

  const exclusivity = resolveAcrossExclusivityParameter({
    exclusiveRelayer: requireAddress(fees.exclusiveRelayer, 'exclusiveRelayer'),
    apiExclusivityDeadline: Number(fees.exclusivityDeadline),
    minExclusivitySec,
  })

  const spokePool = requireAddress(fees.spokePoolAddress, 'spokePool')
  const quoteTimestamp = Number(fees.timestamp)
  const fillDeadline = Number(fees.fillDeadline)
  const outputAmount = BigInt(fees.outputAmount)

  if (outputAmount < price) {
    throw new Error(
      `Across outputAmount ${outputAmount} < key price ${price}; raise --buffer-bps / --amount`,
    )
  }

  process.stdout.write('=== FriendKey Across deposit (RH → Base BuyExecutor) ===\n')
  process.stdout.write(`mode:                ${dryRun ? 'dry-run' : 'execute'}\n`)
  process.stdout.write(`recipient (keys):    ${recipient}\n`)
  process.stdout.write(`buyExecutor:         ${buyExecutor}\n`)
  process.stdout.write(`spokePool (RH):      ${spokePool}\n`)
  process.stdout.write(`tokenId:             ${tokenId.toString()}\n`)
  process.stdout.write(`keys:                ${keyAmount.toString()}\n`)
  process.stdout.write(`price (USDC raw):    ${price.toString()} (${formatUnits(price, 6)} USDC)\n`)
  process.stdout.write(`inputAmount USDG:    ${inputAmount.toString()} (${formatUnits(inputAmount, 6)})\n`)
  process.stdout.write(`outputAmount USDC:   ${outputAmount.toString()} (${formatUnits(outputAmount, 6)})\n`)
  process.stdout.write(`quoteTimestamp:      ${quoteTimestamp}\n`)
  process.stdout.write(`fillDeadline:        ${fillDeadline}\n`)
  process.stdout.write(`api exclusivity:     ${fees.exclusivityDeadline}\n`)
  process.stdout.write(
    `deposit exclusivity: ${exclusivity.exclusivityParameter} (${exclusivity.mode}` +
      `${exclusivity.bumped ? ', bumped from API' : ''})\n`,
  )
  process.stdout.write(`exclusiveRelayer:    ${exclusivity.exclusiveRelayer}\n`)
  process.stdout.write(`estimatedFillSec:    ${fees.estimatedFillTimeSec ?? 'n/a'}\n`)
  process.stdout.write(`message:             ${message}\n`)

  // Across depositV3: depositor is typically msg.sender. Use account address as depositor when executing.
  const depositor = account?.address ?? recipient
  const depositDataForSender = encodeFunctionData({
    abi: spokePoolAbi,
    functionName: 'depositV3',
    args: [
      depositor,
      buyExecutor,
      usdg,
      usdc,
      inputAmount,
      outputAmount,
      BigInt(BASE_CHAIN_ID),
      exclusivity.exclusiveRelayer,
      quoteTimestamp,
      fillDeadline,
      exclusivity.exclusivityParameter,
      message,
    ],
  })

  process.stdout.write(`deposit calldata:    ${depositDataForSender}\n`)

  if (dryRun) {
    process.stdout.write('\nDry-run only. Re-run with --execute --confirm=FRIENDKEY-ACROSS-DEPOSIT\n')
    return
  }

  if (!account) throw new Error('account required')
  const wallet = createWalletClient({
    account,
    chain: robinhood,
    transport: http(rhRpc),
  })

  const balance = await rhPublic.readContract({
    address: usdg,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  if (balance < inputAmount) {
    throw new Error(`USDG balance ${balance} < inputAmount ${inputAmount}`)
  }

  const allowance = await rhPublic.readContract({
    address: usdg,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, spokePool],
  })
  if (allowance < inputAmount) {
    process.stdout.write('approving USDG...\n')
    const approveHash = await wallet.writeContract({
      address: usdg,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spokePool, maxUint256],
      chain: robinhood,
      account,
    })
    await rhPublic.waitForTransactionReceipt({ hash: approveHash })
    process.stdout.write(`approve tx: ${approveHash}\n`)
  }

  // Refresh quote immediately before broadcast (timestamp freshness).
  const fresh = await fetchSuggestedFees({
    inputToken: usdg,
    outputToken: usdc,
    amount: inputAmount,
    recipient: buyExecutor,
    message,
  })
  const freshExclusivity = resolveAcrossExclusivityParameter({
    exclusiveRelayer: requireAddress(fresh.exclusiveRelayer, 'exclusiveRelayer'),
    apiExclusivityDeadline: Number(fresh.exclusivityDeadline),
    minExclusivitySec,
  })
  if (BigInt(fresh.outputAmount) < price) {
    throw new Error(`fresh outputAmount ${fresh.outputAmount} < price ${price}`)
  }

  const freshSpoke = requireAddress(fresh.spokePoolAddress, 'spokePool')
  if (freshSpoke.toLowerCase() !== spokePool.toLowerCase()) {
    const freshAllowance = await rhPublic.readContract({
      address: usdg,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, freshSpoke],
    })
    if (freshAllowance < inputAmount) {
      process.stdout.write('approving USDG on refreshed spokePool...\n')
      const approveHash = await wallet.writeContract({
        address: usdg,
        abi: erc20Abi,
        functionName: 'approve',
        args: [freshSpoke, maxUint256],
        chain: robinhood,
        account,
      })
      await rhPublic.waitForTransactionReceipt({ hash: approveHash })
      process.stdout.write(`approve tx: ${approveHash}\n`)
    }
  }

  process.stdout.write('broadcasting depositV3...\n')
  const depositHash = await wallet.writeContract({
    address: freshSpoke,
    abi: spokePoolAbi,
    functionName: 'depositV3',
    args: [
      account.address,
      buyExecutor,
      usdg,
      usdc,
      inputAmount,
      BigInt(fresh.outputAmount),
      BigInt(BASE_CHAIN_ID),
      freshExclusivity.exclusiveRelayer,
      Number(fresh.timestamp),
      Number(fresh.fillDeadline),
      freshExclusivity.exclusivityParameter,
      message,
    ],
    chain: robinhood,
    account,
  })
  const receipt = await rhPublic.waitForTransactionReceipt({ hash: depositHash })
  process.stdout.write(`deposit tx:  ${depositHash}\n`)
  process.stdout.write(`status:      ${receipt.status}\n`)
  process.stdout.write(
    `explorer:    https://robinhoodchain.blockscout.com/tx/${depositHash}\n`,
  )
  process.stdout.write(
    `exclusivity: ${freshExclusivity.exclusivityParameter} (${freshExclusivity.mode}` +
      `${freshExclusivity.bumped ? ', bumped from API' : ''})` +
      ` relayer=${freshExclusivity.exclusiveRelayer} api=${fresh.exclusivityDeadline}\n`,
  )
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
