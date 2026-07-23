#!/usr/bin/env tsx
/**
 * Read-only Base Sepolia deployment quote for LotteryRelayTestReceiver4626.
 * It never signs, broadcasts, creates an account, or sends a LayerZero packet.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createPublicClient,
  encodeDeployData,
  formatEther,
  getAddress,
  http,
  parseAbi,
  type Abi,
  type Address,
  type Hex,
} from 'viem'
import { baseSepolia } from 'viem/chains'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const ARTIFACT_PATH = resolve(
  REPO_ROOT,
  'out/LotteryRelayTestReceiver4626.sol/LotteryRelayTestReceiver4626.json',
)
const BASE_SEPOLIA_CHAIN_ID = 84_532
const BASE_SEPOLIA_EID = 40_245
const BASE_SEPOLIA_ENDPOINT = getAddress('0x6EDCE65403992e310A62460808c4b910D972f10f')
const ENDPOINT_ABI = parseAbi(['function eid() view returns (uint32)'])

type ReceiverArtifact = {
  abi: Abi
  bytecode: { object: Hex }
}

function required(name: string): string {
  const value = String(process.env[name] ?? '').trim()
  if (!value) throw new Error(`${name.toLowerCase()}_missing`)
  return value
}

async function main(): Promise<void> {
  const rpc = required('BASE_SEPOLIA_RPC_URL')
  const owner = getAddress(required('LOTTERY_RELAY_TEST_RECEIVER_OWNER'))
  const deployerRaw = String(process.env.BASE_SEPOLIA_TEST_RECEIVER_DEPLOYER_ADDRESS ?? '').trim()
  const deployer = deployerRaw ? getAddress(deployerRaw) : null
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as ReceiverArtifact
  const data = encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    args: [BASE_SEPOLIA_ENDPOINT, owner],
  })
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) })

  const [chainId, endpointEid, endpointCode, gasEstimate, gasPrice, deployerBalance] = await Promise.all([
    client.getChainId(),
    client.readContract({ address: BASE_SEPOLIA_ENDPOINT, abi: ENDPOINT_ABI, functionName: 'eid' }),
    client.getCode({ address: BASE_SEPOLIA_ENDPOINT }),
    client.estimateGas({ data }),
    client.getGasPrice(),
    deployer ? client.getBalance({ address: deployer }) : Promise.resolve(null),
  ])
  if (chainId !== BASE_SEPOLIA_CHAIN_ID) throw new Error(`unexpected_chain:${chainId}`)
  if (endpointEid !== BASE_SEPOLIA_EID) throw new Error(`endpoint_eid_mismatch:${endpointEid}`)
  if (!endpointCode || endpointCode === '0x') throw new Error('endpoint_code_missing')

  const estimatedCostWei = gasEstimate * gasPrice
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: 'read_only_quote',
    chain: { id: chainId, name: 'base-sepolia' },
    endpoint: { address: BASE_SEPOLIA_ENDPOINT, eid: endpointEid },
    owner,
    deployer: deployer ? {
      address: deployer,
      balanceWei: deployerBalance?.toString() ?? null,
      balanceEth: deployerBalance == null ? null : formatEther(deployerBalance),
      balanceSufficientAtCurrentGasPrice: deployerBalance == null ? null : deployerBalance >= estimatedCostWei,
    } : null,
    deployment: {
      creationBytecodeBytes: (artifact.bytecode.object.length - 2) / 2,
      gasEstimate: gasEstimate.toString(),
      gasPriceWei: gasPrice.toString(),
      estimatedCostWei: estimatedCostWei.toString(),
      estimatedCostEth: formatEther(estimatedCostWei),
    },
    note: 'Current gas-price estimate only; re-quote immediately before any separately approved broadcast.',
  }, null, 2)}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`lottery test receiver quote failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
