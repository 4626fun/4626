#!/usr/bin/env tsx
/**
 * Tenderly matrix: golden Part 1 UserOp + passkey vs session-key signatures.
 * Requires TENDERLY_API_URL + TENDERLY_ACCESS_TOKEN in frontend/.env
 *
 * Usage: pnpm -C frontend exec tsx --env-file=.env scripts/tenderly-part1-signature-matrix.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  type Hex,
} from 'viem'
import { entryPoint06Address, getUserOperationHash } from 'viem/account-abstraction'

import {
  GOLDEN_RELAY_PART1_DEPOSIT_WEI,
  GOLDEN_RELAY_PART1_ORDER_ID,
  GOLDEN_RELAY_PART1_PROBE_CSW,
  RELAY_DEPOSITORY_ABI,
  RELAY_DEPOSITORY_BASE,
} from '../src/lib/wallet/cswOwnerAbi.js'
import {
  buildTenderlyDashboardUrl,
  parseTenderlyApiUrl,
} from '../server/_lib/debug/tdlyRedirect.js'

const ENTRY_POINT = entryPoint06Address
const CSW = getAddress(GOLDEN_RELAY_PART1_PROBE_CSW)
const BLOCK = 45600637
const NETWORK = '8453'

function loadEnv(): { token: string; apiBase: string; account: string; project: string } {
  const envText = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  const env: Record<string, string> = {}
  for (const line of envText.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const i = trimmed.indexOf('=')
    env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim()
  }
  const token = env.TENDERLY_ACCESS_TOKEN?.trim()
  const apiUrl = env.TENDERLY_API_URL?.trim()
  if (!token || !apiUrl) throw new Error('Missing TENDERLY_* in frontend/.env')
  const route = parseTenderlyApiUrl(apiUrl)
  return { token, apiBase: route.simulateEndpoint.replace(/\/simulate$/, '/'), account: route.account, project: route.project }
}

function wrapOwnerSignature(ownerIndex: number, inner65: Hex): Hex {
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes' }],
    [BigInt(ownerIndex), inner65],
  ) as Hex
}

function passkeyLikeSignature(ownerIndex = 0): Hex {
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes' }],
    [BigInt(ownerIndex), `0x${'ab'.repeat(200)}` as Hex],
  ) as Hex
}

function buildGoldenCallData(): Hex {
  const inner = encodeFunctionData({
    abi: RELAY_DEPOSITORY_ABI,
    functionName: 'depositNative',
    args: [CSW, GOLDEN_RELAY_PART1_ORDER_ID],
  })
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'executeBatch',
        inputs: [
          {
            type: 'tuple[]',
            name: 'calls',
            components: [
              { type: 'address', name: 'target' },
              { type: 'uint256', name: 'value' },
              { type: 'bytes', name: 'data' },
            ],
          },
        ],
        outputs: [],
        stateMutability: 'payable',
      },
    ],
    functionName: 'executeBatch',
    args: [[{ target: getAddress(RELAY_DEPOSITORY_BASE), value: GOLDEN_RELAY_PART1_DEPOSIT_WEI, data: inner }]],
  })
}

type UserOpFields = {
  sender: Hex
  nonce: bigint
  initCode: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: Hex
  signature: Hex
}

function buildBaseUserOp(signature: Hex): UserOpFields {
  return {
    sender: CSW,
    nonce: 162n,
    initCode: '0x',
    callData: buildGoldenCallData(),
    callGasLimit: 19_384n,
    verificationGasLimit: 94_159n,
    preVerificationGas: 118_776n,
    maxFeePerGas: 9_200_000n,
    maxPriorityFeePerGas: 1_500_000n,
    paymasterAndData: '0x',
    signature,
  }
}

function encodeHandleOps(userOp: UserOpFields): Hex {
  const packed = {
    sender: userOp.sender,
    nonce: userOp.nonce,
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: userOp.callGasLimit,
    verificationGasLimit: userOp.verificationGasLimit,
    preVerificationGas: userOp.preVerificationGas,
    maxFeePerGas: userOp.maxFeePerGas,
    maxPriorityFeePerGas: userOp.maxPriorityFeePerGas,
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  }
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'handleOps',
        inputs: [
          {
            type: 'tuple[]',
            name: 'ops',
            components: [
              { type: 'address', name: 'sender' },
              { type: 'uint256', name: 'nonce' },
              { type: 'bytes', name: 'initCode' },
              { type: 'bytes', name: 'callData' },
              { type: 'uint256', name: 'callGasLimit' },
              { type: 'uint256', name: 'verificationGasLimit' },
              { type: 'uint256', name: 'preVerificationGas' },
              { type: 'uint256', name: 'maxFeePerGas' },
              { type: 'uint256', name: 'maxPriorityFeePerGas' },
              { type: 'bytes', name: 'paymasterAndData' },
              { type: 'bytes', name: 'signature' },
            ],
          },
          { type: 'address', name: 'beneficiary' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'handleOps',
    args: [ [packed], '0x0000000000000000000000000000000000000001' ],
  })
}

async function tenderlySimulate(params: {
  token: string
  endpoint: string
  account: string
  project: string
  label: string
  input: Hex
}): Promise<{ label: string; status: boolean; error: string; dashboard?: string; aa?: string[] }> {
  const body = {
    network_id: NETWORK,
    block_number: BLOCK,
    from: '0x0000000000000000000000000000000000000001',
    to: ENTRY_POINT,
    gas: 25_000_000,
    gas_price: 0,
    value: 0,
    input: params.input,
    simulation_type: 'full',
    save: true,
    save_if_fails: true,
  }
  const res = await fetch(`${params.endpoint}simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Access-Key': params.token },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    return { label: params.label, status: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
  }
  const data = JSON.parse(text) as {
    simulation?: { id?: string; status?: boolean; error_message?: string }
    transaction?: { transaction_info?: { call_trace?: { error?: string; calls?: unknown[] } } }
  }
  const sim = data.simulation ?? {}
  const dump = JSON.stringify(data)
  const aa = [...new Set(dump.match(/AA\d+[^"\\]*/g) ?? [])].map((s) => s.replace(/\u0000/g, '').trim())
  return {
    label: params.label,
    status: sim.status === true,
    error: sim.error_message ?? '(none)',
    dashboard: sim.id ? buildTenderlyDashboardUrl(params.account, params.project, sim.id) : undefined,
    aa,
  }
}

async function main(): Promise<void> {
  const { token, apiBase, account, project } = loadEnv()

  const userOpHash = getUserOperationHash({
    chainId: 8453,
    entryPointAddress: ENTRY_POINT,
    entryPointVersion: '0.6',
    userOperation: {
      ...buildBaseUserOp('0x'),
      signature: '0x',
    },
  })

  const cases: Array<{ label: string; signature: Hex }> = [
    { label: 'passkey_owner0_webauthn (your failure shape)', signature: passkeyLikeSignature(0) },
    { label: 'passkey_owner0_empty_inner', signature: wrapOwnerSignature(0, '0x' + '00'.repeat(65) as Hex) },
    { label: 'session_key_owner2_dummy_ecdsa', signature: wrapOwnerSignature(2, '0x' + '22'.repeat(65) as Hex) },
    { label: 'session_key_owner2_bare_ecdsa', signature: '0x' + '22'.repeat(65) as Hex },
    { label: 'owner3_mistaken_slot', signature: wrapOwnerSignature(3, '0x' + '33'.repeat(65) as Hex) },
  ]

  console.log(`Probe CSW: ${CSW}`)
  console.log(`Block: ${BLOCK}`)
  console.log(`UserOp hash (unsigned): ${userOpHash}`)
  console.log('')

  const results = []
  for (const testCase of cases) {
    const input = encodeHandleOps(buildBaseUserOp(testCase.signature))
    const result = await tenderlySimulate({
      token,
      endpoint: apiBase,
      account,
      project,
      label: testCase.label,
      input,
    })
    results.push(result)
    console.log(`${result.status ? 'PASS' : 'FAIL'}  ${result.label}`)
    console.log(`       error: ${result.error}`)
    if (result.aa?.length) console.log(`       aa: ${result.aa.join(', ')}`)
    if (result.dashboard) console.log(`       ${result.dashboard}`)
    console.log('')
  }

  const passkeyFailed = results.filter((r) => r.label.includes('passkey')).every((r) => !r.status)
  const sessionDummyFailed = results
    .filter((r) => r.label.includes('session_key') && r.label.includes('dummy'))
    .every((r) => !r.status)

  console.log('---')
  console.log(
    passkeyFailed
      ? 'OK: passkey shapes fail validation (matches your AA24 failure).'
      : 'WARN: expected passkey shapes to fail',
  )
  console.log(
    sessionDummyFailed
      ? 'OK: dummy session-key ECDSA also fails (expected — needs real Base App signature).'
      : 'NOTE: dummy session-key unexpectedly passed (unlikely)',
  )
  console.log('')
  console.log(
    'Limitation: Tenderly cannot invoke Base App session-key signing. A real pass requires wallet_prepareCalls + personal_sign from Base App WebView.',
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
