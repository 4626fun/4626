#!/usr/bin/env node
/**
 * Point Akita ShareOFT contractURI at a resolvable metadata JSON.
 *
 * Uniswap fetches contractURI for the auction token image. api.4626.fun currently
 * has no DNS A/CNAME, so the default/on-chain api.4626.fun URI fails and Uniswap
 * falls back to a letter placeholder.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import Safe from '@safe-global/protocol-kit'
import { OperationType } from '@safe-global/types-kit'
import { createPublicClient, encodeFunctionData, getAddress, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { resolveProtocolTreasuryAddress } from '../../server/_lib/wallet/protocolTreasurySafe.js'

const SHARE = getAddress('0x44710150A469DE368Abc82F05e6217086Be84626')
const URI = 'https://4626.fun/tokens/akita-share-token.json'

const ABI = [
  {
    type: 'function',
    name: 'setContractURI',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'uri', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'contractURI',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const

function loadFrontendEnvFile(): void {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equals = trimmed.indexOf('=')
    if (equals === -1) continue
    const key = trimmed.slice(0, equals).trim()
    let value = trimmed.slice(equals + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function ownerKey(): Hex {
  for (const raw of [
    process.env.PROTOCOL_TREASURY_SAFE_OWNER_PK,
    process.env.SAFE_OWNER_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ]) {
    const value = String(raw ?? '').trim()
    if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as Hex
  }
  throw new Error('Missing protocol treasury Safe owner private key')
}

function rpcUrl(): string {
  const value = String(process.env.BASE_RPC_URL ?? '').trim()
  if (!value) throw new Error('BASE_RPC_URL required')
  return value.replace('wss://', 'https://').replace('/ws/', '/rpc/')
}

async function main(): Promise<void> {
  loadFrontendEnvFile()
  const key = ownerKey()
  const signer = privateKeyToAccount(key)
  const rpc = rpcUrl()
  const safeAddress = resolveProtocolTreasuryAddress()
  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })

  const [owner, before] = await Promise.all([
    publicClient.readContract({ address: SHARE, abi: ABI, functionName: 'owner' }),
    publicClient.readContract({ address: SHARE, abi: ABI, functionName: 'contractURI' }),
  ])

  console.log('ShareOFT:     ', SHARE)
  console.log('Owner:        ', owner)
  console.log('Treasury Safe:', safeAddress)
  console.log('Signer:       ', signer.address)
  console.log('URI before:   ', before)
  console.log('URI target:   ', URI)

  if (getAddress(owner) !== getAddress(safeAddress)) {
    throw new Error('ShareOFT owner is not protocol treasury Safe')
  }
  if (before === URI) {
    console.log('Already set. Nothing to do.')
    return
  }

  const data = encodeFunctionData({
    abi: ABI,
    functionName: 'setContractURI',
    args: [URI],
  })
  const protocolKit = await Safe.init({ provider: rpc, signer: key, safeAddress })
  const safeTransaction = await protocolKit.createTransaction({
    transactions: [{ to: SHARE, value: '0', data, operation: OperationType.Call }],
  })
  const signed = await protocolKit.signTransaction(safeTransaction)
  const result = await protocolKit.executeTransaction(signed)
  console.log('Safe execute:', result)

  const after = await publicClient.readContract({
    address: SHARE,
    abi: ABI,
    functionName: 'contractURI',
  })
  console.log('URI after:    ', after)
  if (after !== URI) throw new Error(`contractURI mismatch after execute: ${after}`)
  console.log('PASS')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
