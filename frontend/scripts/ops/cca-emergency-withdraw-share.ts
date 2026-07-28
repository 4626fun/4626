#!/usr/bin/env tsx
/**
 * Emergency-withdraw ShareOFT from the CCA launch arm to CANONICAL CSW.
 *
 * Defaults to dry-run. Live treasury Safe tx requires:
 *   --execute --confirm=CCA-EMERGENCY-WITHDRAW
 *
 * Usage:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/cca-emergency-withdraw-share.ts --dry-run
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/cca-emergency-withdraw-share.ts \
 *     --execute --confirm=CCA-EMERGENCY-WITHDRAW
 */
import { createPublicClient, encodeFunctionData, erc20Abi, getAddress, http, type Hex } from 'viem'
import { base } from 'viem/chains'

import { executeViaProtocolTreasurySafe } from '../../server/_lib/wallet/protocolTreasurySafe.js'

const CCA = getAddress('0x44aCFe7E68031Bed3BE801fD242E884e72e0CFD4')
const SHARE = getAddress('0x44710150A469DE368Abc82F05e6217086Be84626')
const TO = getAddress('0xAb6d5C10b03300326CD7fAb7267Ae192842967b5') // CANONICAL CSW
const AMOUNT = 5_000_000n * 10n ** 18n
const CONFIRM_TOKEN = 'CCA-EMERGENCY-WITHDRAW'

const EMERGENCY_ABI = [
  {
    type: 'function',
    name: 'emergencyWithdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
  },
] as const

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function getArg(name: string): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const v = process.argv[idx + 1]
  if (!v || v.startsWith('--')) return ''
  return v
}

async function main() {
  const execute = hasFlag('--execute')
  const dryRun = hasFlag('--dry-run') || !execute
  if (execute && getArg('--confirm') !== CONFIRM_TOKEN) {
    throw new Error(`Live withdraw requires --confirm=${CONFIRM_TOKEN}`)
  }

  const rpcUrl = process.env.BASE_RPC_URL
  if (!rpcUrl) throw new Error('BASE_RPC_URL missing')
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })

  const beforeCca = (await publicClient.readContract({
    address: SHARE,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [CCA],
  })) as bigint
  const beforeTo = (await publicClient.readContract({
    address: SHARE,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [TO],
  })) as bigint

  const amount = beforeCca < AMOUNT ? beforeCca : AMOUNT
  const plan = {
    mode: dryRun ? 'DRY_RUN' : 'EXECUTE',
    cca: CCA,
    share: SHARE,
    to: TO,
    amount: amount.toString(),
    beforeCca: beforeCca.toString(),
    beforeTo: beforeTo.toString(),
  }
  console.log(plan)

  if (amount === 0n) throw new Error('CCA ShareOFT balance is 0')
  if (dryRun) {
    console.log('DRY_RUN complete — re-run with --execute --confirm=' + CONFIRM_TOKEN)
    return
  }

  const data = encodeFunctionData({
    abi: EMERGENCY_ABI,
    functionName: 'emergencyWithdraw',
    args: [SHARE, amount, TO],
  })

  const r = await executeViaProtocolTreasurySafe({
    publicClient: publicClient as never,
    rpcUrl,
    to: CCA,
    data: data as Hex,
  })
  console.log('tx', r)

  const afterCca = (await publicClient.readContract({
    address: SHARE,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [CCA],
  })) as bigint
  const afterTo = (await publicClient.readContract({
    address: SHARE,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [TO],
  })) as bigint
  console.log({ afterCca: afterCca.toString(), afterTo: afterTo.toString() })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
