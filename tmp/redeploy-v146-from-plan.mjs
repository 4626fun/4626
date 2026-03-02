#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  encodePacked,
  getAddress,
  http,
  keccak256,
} from '../frontend/node_modules/viem/_esm/index.js'
import { privateKeyToAccount } from '../frontend/node_modules/viem/_esm/accounts/index.js'
import { base } from '../frontend/node_modules/viem/_esm/chains/index.js'

const EXECUTE_BATCH_ABI = [
  {
    type: 'function',
    name: 'executeBatch',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    outputs: [],
  },
]

const DEPLOY_PHASE1_CORE_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'deployPhase1CoreWithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
]

const FINALIZE_PHASE1_WITH_SALT_ABI = [
  {
    type: 'function',
    name: 'finalizePhase1WithSalt',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vaultName', type: 'string' },
          { name: 'vaultSymbol', type: 'string' },
          { name: 'shareName', type: 'string' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
      { name: 'shareOftSaltOverride', type: 'bytes32' },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'oftBootstrapRegistry', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
        ],
      },
    ],
  },
]

const DEPLOY_PHASE1_CORE_ABI = [
  {
    ...DEPLOY_PHASE1_CORE_WITH_SALT_ABI[0],
    name: 'deployPhase1Core',
    inputs: DEPLOY_PHASE1_CORE_WITH_SALT_ABI[0].inputs.slice(0, 2),
  },
]

const FINALIZE_PHASE1_ABI = [
  {
    ...FINALIZE_PHASE1_WITH_SALT_ABI[0],
    name: 'finalizePhase1',
    inputs: FINALIZE_PHASE1_WITH_SALT_ABI[0].inputs.slice(0, 2),
  },
]

const DEPLOY_PHASE2_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Core',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'creatorTreasury', type: 'address' },
          { name: 'payoutRecipient', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'auction', type: 'address' },
        ],
      },
    ],
  },
]

const FINALIZE_PHASE2_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
          { name: 'meteoraAlphaVault', type: 'bytes32' },
          {
            name: 'solanaIxs',
            type: 'tuple[]',
            components: [
              { name: 'programId', type: 'bytes32' },
              { name: 'serializedAccounts', type: 'bytes[]' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'out',
        type: 'tuple',
        components: [
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'auction', type: 'address' },
        ],
      },
    ],
  },
]

const LAUNCH_DEFERRED_AUCTION_ABI = [
  {
    type: 'function',
    name: 'launchDeferredAuction',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'auction', type: 'address' }],
  },
]

const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
]

const BATCHER_READ_ABI = [
  {
    type: 'function',
    name: 'phase1SplitStates',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'oftBootstrapRegistry', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'shareOFT', type: 'address' },
      { name: 'shareOftSalt', type: 'bytes32' },
      { name: 'paramsHash', type: 'bytes32' },
      { name: 'codeIdsHash', type: 'bytes32' },
      { name: 'coreDone', type: 'bool' },
      { name: 'finalized', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'pendingAuctions',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'shareOFT', type: 'address' },
      { name: 'ccaStrategy', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
]

const CCA_FACTORY_READ_ABI = [
  {
    type: 'function',
    name: 'ccaFactory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
]

const PHASE2_CORE_DEPLOYED_EVENT_ABI = [
  {
    type: 'event',
    name: 'Phase2CoreDeployed',
    inputs: [
      { name: 'creatorToken', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'gaugeController', type: 'address', indexed: false },
      { name: 'ccaStrategy', type: 'address', indexed: false },
      { name: 'oracle', type: 'address', indexed: false },
    ],
    anonymous: false,
  },
]

const AUCTION_LAUNCHED_DEFERRED_EVENT_ABI = [
  {
    type: 'event',
    name: 'AuctionLaunchedDeferred',
    inputs: [
      { name: 'creatorToken', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'shareOFT', type: 'address', indexed: true },
      { name: 'ccaStrategy', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'auction', type: 'address', indexed: false },
    ],
    anonymous: false,
  },
]

function must(value, message) {
  if (!value) throw new Error(message)
  return value
}

function toAddress(v) {
  return getAddress(String(v))
}

function deriveBaseSalt({ creatorToken, owner, version }) {
  return keccak256(
    encodePacked(
      ['address', 'address', 'uint256', 'string', 'string'],
      [creatorToken, owner, 8453n, '4626:deploy:', version],
    ),
  )
}

async function sendBatch({ walletClient, publicClient, account, smartWallet, calls, label }) {
  const data = encodeFunctionData({
    abi: EXECUTE_BATCH_ABI,
    functionName: 'executeBatch',
    args: [calls],
  })
  const hash = await walletClient.sendTransaction({
    account,
    chain: base,
    to: smartWallet,
    data,
    value: 0n,
  })
  console.log(`[tx:${label}] hash=${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') {
    throw new Error(`[tx:${label}] reverted ${hash}`)
  }
  console.log(`[tx:${label}] gasUsed=${receipt.gasUsed} block=${receipt.blockNumber}`)
  return { hash, receipt }
}

function decodeEventArgs({ receipt, abi, eventName }) {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName === eventName) {
        return decoded.args
      }
    } catch {
      // ignore non-matching logs
    }
  }
  return null
}

async function main() {
  const planPath = process.argv[2]
  const newVersion = process.argv[3] || 'v1.4.6'
  must(planPath, 'usage: node redeploy-v146-from-plan.mjs <plan.json> [newVersion]')

  const privateKeyRaw = String(process.env.PRIVATE_KEY || '').trim()
  must(privateKeyRaw, 'Missing PRIVATE_KEY in environment')
  const privateKey = privateKeyRaw.startsWith('0x') ? privateKeyRaw : `0x${privateKeyRaw}`

  const raw = await fs.readFile(path.resolve(process.cwd(), planPath), 'utf8')
  const plan = JSON.parse(raw)

  const smartWallet = toAddress(plan.smartWallet)
  const batcher = toAddress(plan.phase1Calls?.[0]?.to)
  const creatorToken = toAddress(plan.creatorToken)
  const owner = toAddress(plan.ownerAddress)

  const account = privateKeyToAccount(privateKey)
  const signer = toAddress(account.address)

  const publicClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org') })
  const walletClient = createWalletClient({ account, chain: base, transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org') })

  console.log(`[plan] smartWallet=${smartWallet} owner=${owner} signer=${signer} batcher=${batcher}`)
  if (signer.toLowerCase() === smartWallet.toLowerCase()) {
    throw new Error('Signer is smart wallet itself; expected EOA owner')
  }

  const oldPhase1Core = must(plan.phase1Calls?.[0]?.data, 'Missing phase1 core call data')
  const oldPhase1Finalize = must(plan.phase1Calls?.[1]?.data, 'Missing phase1 finalize call data')
  const oldPhase2Core = must(plan.phase2CoreCalls?.[0]?.data, 'Missing phase2 core call data')
  const oldPhase2Finalize = must(plan.phase2FinalizeCalls?.[0]?.data, 'Missing phase2 finalize call data')
  const oldPhase4 = must(plan.phase4Calls?.[0]?.data, 'Missing phase4 call data')

  const phase1CoreDecoded = decodeFunctionData({ abi: DEPLOY_PHASE1_CORE_WITH_SALT_ABI, data: oldPhase1Core })
  const phase1FinalizeDecoded = decodeFunctionData({ abi: FINALIZE_PHASE1_WITH_SALT_ABI, data: oldPhase1Finalize })
  const phase2CoreDecoded = decodeFunctionData({ abi: DEPLOY_PHASE2_CORE_ABI, data: oldPhase2Core })
  const phase2FinalizeDecoded = decodeFunctionData({ abi: FINALIZE_PHASE2_ABI, data: oldPhase2Finalize })
  const phase4Decoded = decodeFunctionData({ abi: LAUNCH_DEFERRED_AUCTION_ABI, data: oldPhase4 })

  const phase1Params = { ...phase1CoreDecoded.args[0], version: newVersion }
  const phase1CodeIds = phase1CoreDecoded.args[1]
  const phase2CodeIdsDecoded = phase2CoreDecoded.args[1]
  const ccaCodeIdOverrideRaw = String(process.env.CCA_CODE_ID_OVERRIDE || '').trim()
  const phase2CodeIds = {
    vault: phase2CodeIdsDecoded.vault,
    wrapper: phase2CodeIdsDecoded.wrapper,
    shareOFT: phase2CodeIdsDecoded.shareOFT,
    gauge: phase2CodeIdsDecoded.gauge,
    cca:
      ccaCodeIdOverrideRaw.length > 0
        ? ccaCodeIdOverrideRaw
        : phase2CodeIdsDecoded.cca,
    oracle: phase2CodeIdsDecoded.oracle,
    oftBootstrap: phase2CodeIdsDecoded.oftBootstrap,
  }
  const phase2CoreTemplate = phase2CoreDecoded.args[0]
  const phase2FinalizeTemplate = phase2FinalizeDecoded.args[0]
  const phase4Template = phase4Decoded.args[0]

  if (toAddress(phase1Params.owner) !== smartWallet || toAddress(phase1Params.owner) !== owner) {
    throw new Error('Owner mismatch between plan and phase1 params')
  }

  console.log(`[version] ${plan.version || '(none)'} -> ${newVersion}`)
  console.log(`[codeId] CCA=${phase2CodeIds.cca}`)

  const phase1CoreData = encodeFunctionData({
    abi: DEPLOY_PHASE1_CORE_ABI,
    functionName: 'deployPhase1Core',
    args: [phase1Params, phase1CodeIds],
  })
  const phase1FinalizeData = encodeFunctionData({
    abi: FINALIZE_PHASE1_ABI,
    functionName: 'finalizePhase1',
    args: [phase1Params, phase1CodeIds],
  })

  await sendBatch({
    walletClient,
    publicClient,
    account,
    smartWallet,
    label: 'phase1-core+finalize',
    calls: [
      { target: batcher, value: 0n, data: phase1CoreData },
      { target: batcher, value: 0n, data: phase1FinalizeData },
    ],
  })

  const baseSalt = deriveBaseSalt({ creatorToken, owner, version: newVersion })
  const phase1State = await publicClient.readContract({
    address: batcher,
    abi: BATCHER_READ_ABI,
    functionName: 'phase1SplitStates',
    args: [baseSalt],
  })

  const oftBootstrapRegistry = toAddress(phase1State[0])
  const vault = toAddress(phase1State[1])
  const wrapper = toAddress(phase1State[2])
  const shareOFT = toAddress(phase1State[3])
  const coreDone = Boolean(phase1State[7])
  const finalized = Boolean(phase1State[8])
  if (!coreDone || !finalized) throw new Error('phase1 state not finalized')

  console.log(`[phase1] oftBootstrap=${oftBootstrapRegistry} vault=${vault} wrapper=${wrapper} shareOFT=${shareOFT}`)

  const phase2CoreParams = {
    ...phase2CoreTemplate,
    vault,
    wrapper,
    shareOFT,
    version: newVersion,
  }
  const phase2CoreData = encodeFunctionData({
    abi: DEPLOY_PHASE2_CORE_ABI,
    functionName: 'deployPhase2Core',
    args: [phase2CoreParams, phase2CodeIds],
  })

  const phase2CoreTx = await sendBatch({
    walletClient,
    publicClient,
    account,
    smartWallet,
    label: 'phase2-core',
    calls: [{ target: batcher, value: 0n, data: phase2CoreData }],
  })

  const phase2CoreEvent = decodeEventArgs({
    receipt: phase2CoreTx.receipt,
    abi: PHASE2_CORE_DEPLOYED_EVENT_ABI,
    eventName: 'Phase2CoreDeployed',
  })
  must(phase2CoreEvent, 'Phase2CoreDeployed event not found')

  const gaugeController = toAddress(phase2CoreEvent.gaugeController)
  const ccaStrategy = toAddress(phase2CoreEvent.ccaStrategy)
  const oracle = toAddress(phase2CoreEvent.oracle)
  console.log(`[phase2-core] gauge=${gaugeController} cca=${ccaStrategy} oracle=${oracle}`)

  const phase2FinalizeParams = {
    ...phase2FinalizeTemplate,
    vault,
    wrapper,
    shareOFT,
    gaugeController,
    ccaStrategy,
    oracle,
    version: newVersion,
  }
  const approveData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [batcher, phase2FinalizeParams.depositAmount],
  })
  const phase2FinalizeData = encodeFunctionData({
    abi: FINALIZE_PHASE2_ABI,
    functionName: 'finalizePhase2',
    args: [phase2FinalizeParams],
  })

  await sendBatch({
    walletClient,
    publicClient,
    account,
    smartWallet,
    label: 'phase2-finalize',
    calls: [
      { target: creatorToken, value: 0n, data: approveData },
      { target: batcher, value: 0n, data: phase2FinalizeData },
    ],
  })

  const pending = await publicClient.readContract({
    address: batcher,
    abi: BATCHER_READ_ABI,
    functionName: 'pendingAuctions',
    args: [baseSalt],
  })
  const pendingShareOft = toAddress(pending[0])
  const pendingCca = toAddress(pending[1])
  const pendingAmount = BigInt(pending[2])
  if (pendingAmount <= 0n) throw new Error('No pending auction amount after phase2 finalize')
  console.log(`[pending] shareOFT=${pendingShareOft} cca=${pendingCca} amount=${pendingAmount}`)

  const phase4Params = {
    ...phase4Template,
    shareOFT,
    version: newVersion,
  }
  const phase4Data = encodeFunctionData({
    abi: LAUNCH_DEFERRED_AUCTION_ABI,
    functionName: 'launchDeferredAuction',
    args: [phase4Params],
  })

  const phase4Tx = await sendBatch({
    walletClient,
    publicClient,
    account,
    smartWallet,
    label: 'phase4-launch-deferred',
    calls: [{ target: batcher, value: 0n, data: phase4Data }],
  })

  const launchedEvent = decodeEventArgs({
    receipt: phase4Tx.receipt,
    abi: AUCTION_LAUNCHED_DEFERRED_EVENT_ABI,
    eventName: 'AuctionLaunchedDeferred',
  })
  must(launchedEvent, 'AuctionLaunchedDeferred event not found')
  const auction = toAddress(launchedEvent.auction)

  const ccaFactory = toAddress(
    await publicClient.readContract({
      address: ccaStrategy,
      abi: CCA_FACTORY_READ_ABI,
      functionName: 'ccaFactory',
    }),
  )

  console.log('')
  console.log('=== Redeploy Complete ===')
  console.log(`version=${newVersion}`)
  console.log(`vault=${vault}`)
  console.log(`wrapper=${wrapper}`)
  console.log(`shareOFT=${shareOFT}`)
  console.log(`gaugeController=${gaugeController}`)
  console.log(`ccaStrategy=${ccaStrategy}`)
  console.log(`ccaFactory=${ccaFactory}`)
  console.log(`oracle=${oracle}`)
  console.log(`auction=${auction}`)
}

main().catch((err) => {
  const msg = err?.message ? String(err.message) : String(err)
  console.error(`redeploy failed: ${msg}`)
  process.exit(1)
})

