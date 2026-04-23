import {
  createPublicClient,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  http,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem'
import { base } from 'viem/chains'

import {
  makeSessionToken,
  getApiContracts,
} from '../../../../../packages/server-core/src/index.js'


import { asTrimmed } from '../utils.js'

declare const process: { env: Record<string, string | undefined> }

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as const
const OFT_BOOTSTRAP_LABEL = '4626:OFTBootstrapRegistry:v1'
const DEFAULT_MIN_FIRST_DEPOSIT_TOKENS = 50_000_000n
const DEFAULT_MIN_FIRST_DEPOSIT_WEI = DEFAULT_MIN_FIRST_DEPOSIT_TOKENS * 10n ** 18n

type ReadContractClient = Pick<PublicClient, 'readContract'>

const BATCHER_PHASE1_CORE_WITH_SALT_ABI = [
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
] as const

const BATCHER_FINALIZE_PHASE1_WITH_SALT_ABI = [
  {
    ...BATCHER_PHASE1_CORE_WITH_SALT_ABI[0],
    name: 'finalizePhase1WithSalt',
  },
] as const

const BATCHER_PHASE2_CORE_ABI = [
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
] as const

const BATCHER_FINALIZE_PHASE2_ABI = [
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
] as const

const BATCHER_LAUNCH_DEFERRED_AUCTION_ABI = [
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
] as const

const BATCHER_DEPLOY_VIEW_ABI = [
  { type: 'function', name: 'bytecodeStore', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'create2Deployer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'registry', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'chainlinkEthUsd', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'protocolTreasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const BYTECODE_STORE_ABI = [
  { type: 'function', name: 'get', stateMutability: 'view', inputs: [{ name: 'codeId', type: 'bytes32' }], outputs: [{ type: 'bytes' }] },
] as const

const CREATE2_DEPLOYER_ABI = [
  {
    type: 'function',
    name: 'computeAddress',
    stateMutability: 'view',
    inputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'initCodeHash', type: 'bytes32' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const

const ERC20_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

const AKITA_TEMPLATE = {
  creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
  phase1CoreData:
    '0x4154f24e0000000000000000000000000000000000000000000000000000000000000120e2d09c8026c3a2dcac5245c42dfe04a29e5826a099e5bab27d718da2ee8f0a5d74dbe441a0b3e242c6c2e4aa4e0bbde203da6e9d6ba5670f50811dbb7eb95685a4685e1c405f058ce20d8d970b14707f2e53fbed35cef8f25442f2eeac8e70fa37f3626c4c177d384df8a6191d8bed5b5fcace307ff1a32f5182c28c7eb2cdc33dcb8ee15ab354715c45e233c0f5882e58bf0bcf1aec524097e18692b640107453fdfca230fe715b2c072b8bcc78a7df42ed4e5ff032f42dd1ba75603b7693c906c9eccb30c69f8adbff99f52e7c1f675a9c7117edcb8c7c2e91e6e124a3dd5ff31ffeb1f45f5d471cfe4aee7b98b670a9dbe00b2b2b13eba57a24ab179824430000000000000000000000005b674196812451b7cec024fe9d22d2c0b172fa75000000000000000000000000ab6d5c10b03300326cd7fab7267ae192842967b500000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000011416b697461205661756c7420546f6b656e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008e296a2414b4954410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011416b69746120536861726520546f6b656e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008e296a0414b495441000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000676312e342e370000000000000000000000000000000000000000000000000000',
  phase1FinalizeData:
    '0x3bc09a8b0000000000000000000000000000000000000000000000000000000000000120e2d09c8026c3a2dcac5245c42dfe04a29e5826a099e5bab27d718da2ee8f0a5d74dbe441a0b3e242c6c2e4aa4e0bbde203da6e9d6ba5670f50811dbb7eb95685a4685e1c405f058ce20d8d970b14707f2e53fbed35cef8f25442f2eeac8e70fa37f3626c4c177d384df8a6191d8bed5b5fcace307ff1a32f5182c28c7eb2cdc33dcb8ee15ab354715c45e233c0f5882e58bf0bcf1aec524097e18692b640107453fdfca230fe715b2c072b8bcc78a7df42ed4e5ff032f42dd1ba75603b7693c906c9eccb30c69f8adbff99f52e7c1f675a9c7117edcb8c7c2e91e6e124a3dd5ff31ffeb1f45f5d471cfe4aee7b98b670a9dbe00b2b2b13eba57a24ab179824430000000000000000000000005b674196812451b7cec024fe9d22d2c0b172fa75000000000000000000000000ab6d5c10b03300326cd7fab7267ae192842967b500000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000011416b697461205661756c7420546f6b656e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008e296a2414b4954410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011416b69746120536861726520546f6b656e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008e296a0414b495441000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000676312e342e370000000000000000000000000000000000000000000000000000',
  phase2CoreData:
    '0xf9344d880000000000000000000000000000000000000000000000000000000000000100e2d09c8026c3a2dcac5245c42dfe04a29e5826a099e5bab27d718da2ee8f0a5d74dbe441a0b3e242c6c2e4aa4e0bbde203da6e9d6ba5670f50811dbb7eb95685a4685e1c405f058ce20d8d970b14707f2e53fbed35cef8f25442f2eeac8e70fa37f3626c4c177d384df8a6191d8bed5b5fcace307ff1a32f5182c28c7eb2cdc33dcb8ee15ab354715c45e233c0f5882e58bf0bcf1aec524097e18692b640107453fdfca230fe715b2c072b8bcc78a7df42ed4e5ff032f42dd1ba75603b7693c906c9eccb30c69f8adbff99f52e7c1f675a9c7117edcb8c7c2e91e6e124a3dd5f0000000000000000000000005b674196812451b7cec024fe9d22d2c0b172fa75000000000000000000000000ab6d5c10b03300326cd7fab7267ae192842967b5000000000000000000000000ab6d5c10b03300326cd7fab7267ae192842967b5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000059e1e67b201b1dfc549fd341a31f5224dce1f7c70000000000000000000000002e397dcadad1cefdf98d54aa044e4962088cd7a600000000000000000000000051ddec69430dbf43bc34ba60f37788274d8896150000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000ef7dcc7da04b6f6140000000000000000000000000000000000000000000000000000000000000008e296a0414b495441000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000676312e342e370000000000000000000000000000000000000000000000000000',
  phase2FinalizeData:
    '0xbd4583fb00000000000000000000000000000000000000000000000000000000000000200000000000000000000000005b674196812451b7cec024fe9d22d2c0b172fa75000000000000000000000000ab6d5c10b03300326cd7fab7267ae192842967b500000000000000000000000059e1e67b201b1dfc549fd341a31f5224dce1f7c70000000000000000000000002e397dcadad1cefdf98d54aa044e4962088cd7a600000000000000000000000051ddec69430dbf43bc34ba60f37788274d889615000000000000000000000000df6675329a992aa2531275d09ba531a7f497ccf100000000000000000000000055e65b42cbd40e7d45bc8b325ecb3313bc23a75700000000000000000000000027c6f743b74b15c0b61933e0f4d707000bf58be300000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000422ca8b0a00a425000000000000000000000000000000000000000000000000000000016345785d8a000000000000000000000000000000000000000000000000000ef7dcc7da04b6f614000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000000676312e342e370000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000002200000051400000210000044c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  phase4Data:
    '0x02afdbcb00000000000000000000000000000000000000000000000000000000000000200000000000000000000000005b674196812451b7cec024fe9d22d2c0b172fa75000000000000000000000000ab6d5c10b03300326cd7fab7267ae192842967b500000000000000000000000051ddec69430dbf43bc34ba60f37788274d88961500000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000ef7dcc7da04b6f614000000000000000000000000000000000000000000000000016345785d8a00000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000676312e342e370000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000002200000051400000210000044c0000000000000000000000000000000000',
} as const

type SessionCall = { to: Address; value: string; data: Hex }

export type VaultDeployContracts = {
  creatorToken: Address
  vault: Address | null
  wrapper: Address | null
  shareOFT: Address | null
  gaugeController: Address | null
  ccaStrategy: Address | null
  oracle: Address | null
}

export type VaultDeployStartRequest = {
  smartWallet: Address
  creatorToken: Address
  ownerAddress: Address
  phase1Calls: SessionCall[]
  phase2CoreCalls: SessionCall[]
  phase2FinalizeCalls: SessionCall[]
  phase3Calls: SessionCall[]
  phase4Calls: SessionCall[]
  version: string
  autoContinue: boolean
}

type StartPayload = {
  sessionId?: string
  sessionSignerAddress?: Address
  expiresAt?: string
  ownerInstalled?: boolean | null
  continueTriggered?: boolean
  nextAction?: string
  continueStatus?: number
  predictedContracts?: VaultDeployContracts
}

export type VaultDeployStartResult =
  | { ok: true; status: number; data: StartPayload }
  | { ok: false; status: number; error: string }

type StatusPayload = {
  id?: string
  step?: string
  expiresAt?: string
  lastError?: string | null
  lastUserOpHash?: string | null
  lastTxHash?: string | null
  launchImage?: {
    shareOft?: Address | null
    vaultAddress?: Address | null
  } | null
  diagnostics?: {
    replay?: {
      phase2CoreSkipRecorded?: boolean
      phase2FinalizeSkipRecorded?: boolean
    }
  } | null
}

export type VaultDeployStatusResult =
  | { ok: true; status: number; data: StatusPayload }
  | { ok: false; status: number; error: string }

function lowerAscii(input: string): string {
  return input.replace(/[A-Z]/g, (c) => c.toLowerCase())
}

function upperAscii(input: string): string {
  return input.replace(/[a-z]/g, (c) => c.toUpperCase())
}

function concatHex(a: Hex, b: Hex): Hex {
  return `0x${a.slice(2)}${b.slice(2)}` as Hex
}

function deriveBaseSalt(params: { creatorToken: Address; owner: Address; version: string }): Hex {
  return keccak256(
    encodePacked(
      ['address', 'address', 'uint256', 'string', 'string'],
      [params.creatorToken, params.owner, 8453n, '4626:deploy:', params.version],
    ),
  )
}

function saltFor(baseSalt: Hex, label: string): Hex {
  return keccak256(encodePacked(['bytes32', 'string'], [baseSalt, label]))
}

function deriveShareOftSalt(params: { owner: Address; shareSymbolLower: string; version: string }): Hex {
  const baseSalt = keccak256(encodePacked(['address', 'string'], [params.owner, params.shareSymbolLower]))
  return keccak256(encodePacked(['bytes32', 'string', 'string'], [baseSalt, 'CreatorShareOFT:', params.version]))
}

function getRpcUrl(): string {
  const raw = asTrimmed(process.env.BASE_RPC_URL ?? '')
  return raw || 'https://mainnet.base.org'
}

function getCanonicalOrigin(): string {
  const candidates = [
    asTrimmed(process.env.CANONICAL_ORIGIN ?? ''),
    asTrimmed(process.env.VITE_CANONICAL_ORIGIN ?? ''),
    asTrimmed(process.env.APP_ORIGIN ?? ''),
    'https://4626.fun',
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate)
      return url.origin
    } catch {
      continue
    }
  }
  return 'https://4626.fun'
}

async function computeCreate2Address(params: {
  publicClient: ReadContractClient
  create2Deployer: Address
  salt: Hex
  initCodeHash: Hex
}): Promise<Address> {
  const predicted = (await params.publicClient.readContract({
    address: params.create2Deployer,
    abi: CREATE2_DEPLOYER_ABI,
    functionName: 'computeAddress',
    args: [params.salt, params.initCodeHash],
  })) as Address
  return getAddress(predicted)
}

async function getBytecode(params: {
  publicClient: ReadContractClient
  store: Address
  codeId: Hex
}): Promise<Hex> {
  const bytecode = (await params.publicClient.readContract({
    address: params.store,
    abi: BYTECODE_STORE_ABI,
    functionName: 'get',
    args: [params.codeId],
  })) as Hex
  return bytecode
}

type PredictedDeployAddresses = {
  vault: Address
  wrapper: Address
  shareOFT: Address
  oftBootstrapRegistry: Address
  gaugeController: Address
  ccaStrategy: Address
  oracle: Address
}

async function predictDeployAddresses(params: {
  batcher: Address
  creatorToken: Address
  owner: Address
  version: string
  phase1Params: any
  codeIds: any
}): Promise<PredictedDeployAddresses> {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(getRpcUrl(), { timeout: 15_000 }),
  })
  const [bytecodeStoreRaw, create2DeployerRaw, registryRaw, chainlinkEthUsdRaw, protocolTreasuryRaw] = (await Promise.all([
    publicClient.readContract({
      address: params.batcher,
      abi: BATCHER_DEPLOY_VIEW_ABI,
      functionName: 'bytecodeStore',
    }),
    publicClient.readContract({
      address: params.batcher,
      abi: BATCHER_DEPLOY_VIEW_ABI,
      functionName: 'create2Deployer',
    }),
    publicClient.readContract({
      address: params.batcher,
      abi: BATCHER_DEPLOY_VIEW_ABI,
      functionName: 'registry',
    }),
    publicClient.readContract({
      address: params.batcher,
      abi: BATCHER_DEPLOY_VIEW_ABI,
      functionName: 'chainlinkEthUsd',
    }),
    publicClient.readContract({
      address: params.batcher,
      abi: BATCHER_DEPLOY_VIEW_ABI,
      functionName: 'protocolTreasury',
    }),
  ])) as [Address, Address, Address, Address, Address]

  const bytecodeStore = getAddress(bytecodeStoreRaw)
  const create2Deployer = getAddress(create2DeployerRaw)
  const registry = getAddress(registryRaw)
  const chainlinkEthUsd = getAddress(chainlinkEthUsdRaw)
  const protocolTreasury = getAddress(protocolTreasuryRaw)
  const tempOwner = params.batcher

  const baseSalt = deriveBaseSalt({
    creatorToken: params.creatorToken,
    owner: params.owner,
    version: params.version,
  })
  const vaultSalt = saltFor(baseSalt, 'vault')
  const wrapperSalt = saltFor(baseSalt, 'wrapper')
  const gaugeSalt = saltFor(baseSalt, 'gauge')
  const ccaSalt = saltFor(baseSalt, 'cca')
  const oracleSalt = saltFor(baseSalt, 'oracle')
  const oftBootstrapSalt = keccak256(encodePacked(['string'], [OFT_BOOTSTRAP_LABEL]))

  const shareSymbol = String(params.phase1Params.shareSymbol ?? '')
  const shareSymbolUpper = upperAscii(shareSymbol)
  const shareSymbolLower = lowerAscii(shareSymbol)
  const shareOftSalt = deriveShareOftSalt({
    owner: params.owner,
    shareSymbolLower,
    version: params.version,
  })

  const vaultCode = await getBytecode({
    publicClient,
    store: bytecodeStore,
    codeId: params.codeIds.vault as Hex,
  })
  const wrapperCode = await getBytecode({
    publicClient,
    store: bytecodeStore,
    codeId: params.codeIds.wrapper as Hex,
  })
  const shareCode = await getBytecode({
    publicClient,
    store: bytecodeStore,
    codeId: params.codeIds.shareOFT as Hex,
  })
  const gaugeCode = await getBytecode({
    publicClient,
    store: bytecodeStore,
    codeId: params.codeIds.gauge as Hex,
  })
  const ccaCode = await getBytecode({
    publicClient,
    store: bytecodeStore,
    codeId: params.codeIds.cca as Hex,
  })
  const oracleCode = await getBytecode({
    publicClient,
    store: bytecodeStore,
    codeId: params.codeIds.oracle as Hex,
  })
  const oftBootstrapCode = await getBytecode({
    publicClient,
    store: bytecodeStore,
    codeId: params.codeIds.oftBootstrap as Hex,
  })

  const vaultArgs = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'string' },
      { type: 'string' },
    ],
    [params.creatorToken, tempOwner, String(params.phase1Params.vaultName ?? ''), String(params.phase1Params.vaultSymbol ?? '')],
  ) as Hex
  const vaultInitCodeHash = keccak256(concatHex(vaultCode, vaultArgs))
  const vault = await computeCreate2Address({
    publicClient,
    create2Deployer,
    salt: vaultSalt,
    initCodeHash: vaultInitCodeHash,
  })

  const wrapperArgs = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'address' },
    ],
    [params.creatorToken, vault, tempOwner],
  ) as Hex
  const wrapperInitCodeHash = keccak256(concatHex(wrapperCode, wrapperArgs))
  const wrapper = await computeCreate2Address({
    publicClient,
    create2Deployer,
    salt: wrapperSalt,
    initCodeHash: wrapperInitCodeHash,
  })

  const oftBootstrapInitCodeHash = keccak256(oftBootstrapCode)
  const oftBootstrapRegistry = await computeCreate2Address({
    publicClient,
    create2Deployer,
    salt: oftBootstrapSalt,
    initCodeHash: oftBootstrapInitCodeHash,
  })

  const shareArgs = encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'string' },
      { type: 'address' },
      { type: 'address' },
    ],
    [String(params.phase1Params.shareName ?? ''), shareSymbolUpper, oftBootstrapRegistry, tempOwner],
  ) as Hex
  const shareInitCodeHash = keccak256(concatHex(shareCode, shareArgs))
  const shareOFT = await computeCreate2Address({
    publicClient,
    create2Deployer,
    salt: shareOftSalt,
    initCodeHash: shareInitCodeHash,
  })

  const gaugeArgs = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'address' },
      { type: 'address' },
    ],
    [shareOFT, params.owner, protocolTreasury, tempOwner],
  ) as Hex
  const gaugeInitCodeHash = keccak256(concatHex(gaugeCode, gaugeArgs))
  const gaugeController = await computeCreate2Address({
    publicClient,
    create2Deployer,
    salt: gaugeSalt,
    initCodeHash: gaugeInitCodeHash,
  })

  const ccaArgs = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'address' },
      { type: 'address' },
      { type: 'address' },
    ],
    [shareOFT, getAddress('0x0000000000000000000000000000000000000000'), vault, vault, tempOwner],
  ) as Hex
  const ccaInitCodeHash = keccak256(concatHex(ccaCode, ccaArgs))
  const ccaStrategy = await computeCreate2Address({
    publicClient,
    create2Deployer,
    salt: ccaSalt,
    initCodeHash: ccaInitCodeHash,
  })

  const oracleArgs = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'string' },
      { type: 'address' },
    ],
    [registry, chainlinkEthUsd, shareSymbolLower, tempOwner],
  ) as Hex
  const oracleInitCodeHash = keccak256(concatHex(oracleCode, oracleArgs))
  const oracle = await computeCreate2Address({
    publicClient,
    create2Deployer,
    salt: oracleSalt,
    initCodeHash: oracleInitCodeHash,
  })

  return {
    vault,
    wrapper,
    shareOFT,
    oftBootstrapRegistry,
    gaugeController,
    ccaStrategy,
    oracle,
  }
}

function extractPredictedContractsFromFinalizeCall(params: {
  creatorToken: Address
  finalizeCallData: Hex
}): VaultDeployContracts {
  const fallback: VaultDeployContracts = {
    creatorToken: params.creatorToken,
    vault: null,
    wrapper: null,
    shareOFT: null,
    gaugeController: null,
    ccaStrategy: null,
    oracle: null,
  }
  try {
    const decoded = decodeFunctionData({
      abi: BATCHER_FINALIZE_PHASE2_ABI,
      data: params.finalizeCallData,
    }) as any
    const callParams = (decoded?.args?.[0] ?? {}) as Record<string, unknown>
    const normalizeMaybeAddress = (raw: unknown): Address | null => {
      if (typeof raw !== 'string') return null
      try {
        return getAddress(raw as Address)
      } catch {
        return null
      }
    }
    return {
      creatorToken: params.creatorToken,
      vault: normalizeMaybeAddress(callParams.vault),
      wrapper: normalizeMaybeAddress(callParams.wrapper),
      shareOFT: normalizeMaybeAddress(callParams.shareOFT),
      gaugeController: normalizeMaybeAddress(callParams.gaugeController),
      ccaStrategy: normalizeMaybeAddress(callParams.ccaStrategy),
      oracle: normalizeMaybeAddress(callParams.oracle),
    }
  } catch {
    return fallback
  }
}

export function formatVaultDeployPreviewText(params: {
  version: string
  creatorToken: Address
  smartWallet: Address
  expiresAt: string
}): string {
  return [
    'Vault Deploy Preview • AKITA',
    '',
    `- creatorToken: ${params.creatorToken}`,
    `- smartWallet: ${params.smartWallet}`,
    `- version: ${params.version}`,
    '- flow: deploy-session start -> auto-continue when owner is installed',
    '',
    `Token expires: ${params.expiresAt}`,
  ].join('\n')
}

export function buildVaultDeployPreviewReplyMarkup(token: string): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        { text: 'Confirm', callback_data: `vaultdeploy:confirm:${token}` },
        { text: 'Decline', callback_data: `vaultdeploy:decline:${token}` },
      ],
    ],
  }
}

export function formatVaultDeployTokenFailure(reason: 'not_found' | 'expired' | 'consumed' | 'scope_mismatch'): string {
  if (reason === 'expired') return 'Vault deploy confirmation expired. Start a new `/vaultdeploy` preview.'
  if (reason === 'consumed') return 'This vault deploy preview was already confirmed or cancelled.'
  if (reason === 'scope_mismatch') return 'Vault deploy confirmation scope mismatch. Use a fresh preview from this chat.'
  return 'Vault deploy confirmation token not found. Start a new `/vaultdeploy` preview.'
}

export async function buildAkitaVaultDeployStartRequest(params: {
  canonicalSmartWallet: Address
  version: string
}): Promise<VaultDeployStartRequest> {
  const canonicalSmartWallet = getAddress(params.canonicalSmartWallet)
  const creatorToken = getAddress(AKITA_TEMPLATE.creatorToken)

  const contracts = getApiContracts()
  const batcherRaw = asTrimmed(contracts.creatorVaultBatcher ?? '')
  if (!batcherRaw) {
    throw new Error('creator_vault_batcher_not_configured')
  }
  const batcher = getAddress(batcherRaw as Address)

  const phase1CoreDecoded = decodeFunctionData({
    abi: BATCHER_PHASE1_CORE_WITH_SALT_ABI,
    data: AKITA_TEMPLATE.phase1CoreData,
  }) as any
  const phase1FinalizeDecoded = decodeFunctionData({
    abi: BATCHER_FINALIZE_PHASE1_WITH_SALT_ABI,
    data: AKITA_TEMPLATE.phase1FinalizeData,
  }) as any
  const phase2CoreDecoded = decodeFunctionData({
    abi: BATCHER_PHASE2_CORE_ABI,
    data: AKITA_TEMPLATE.phase2CoreData,
  }) as any
  const phase2FinalizeDecoded = decodeFunctionData({
    abi: BATCHER_FINALIZE_PHASE2_ABI,
    data: AKITA_TEMPLATE.phase2FinalizeData,
  }) as any
  const phase4Decoded = decodeFunctionData({
    abi: BATCHER_LAUNCH_DEFERRED_AUCTION_ABI,
    data: AKITA_TEMPLATE.phase4Data,
  }) as any

  const phase1CodeIds = phase1CoreDecoded.args?.[1]
  if (!phase1CodeIds) {
    throw new Error('missing_phase1_code_ids')
  }

  const phase1Params = {
    ...(phase1CoreDecoded.args?.[0] ?? {}),
    creatorToken,
    owner: canonicalSmartWallet,
    version: params.version,
  }
  const shareOftSaltOverride = (phase1CoreDecoded.args?.[2] as Hex | undefined) ?? ZERO_BYTES32

  const predicted = await predictDeployAddresses({
    batcher,
    creatorToken,
    owner: canonicalSmartWallet,
    version: params.version,
    phase1Params,
    codeIds: phase1CodeIds,
  })

  const phase2CodeIds = phase2CoreDecoded.args?.[1] ?? phase1CodeIds
  const phase2CoreParams = {
    ...(phase2CoreDecoded.args?.[0] ?? {}),
    creatorToken,
    owner: canonicalSmartWallet,
    creatorTreasury: canonicalSmartWallet,
    vault: predicted.vault,
    wrapper: predicted.wrapper,
    shareOFT: predicted.shareOFT,
    version: params.version,
  }

  const phase2FinalizeParams = {
    ...(phase2FinalizeDecoded.args?.[0] ?? {}),
    creatorToken,
    owner: canonicalSmartWallet,
    vault: predicted.vault,
    wrapper: predicted.wrapper,
    shareOFT: predicted.shareOFT,
    gaugeController: predicted.gaugeController,
    ccaStrategy: predicted.ccaStrategy,
    oracle: predicted.oracle,
    depositAmount: DEFAULT_MIN_FIRST_DEPOSIT_WEI,
    version: params.version,
  }

  const phase4Params = {
    ...(phase4Decoded.args?.[0] ?? {}),
    creatorToken,
    owner: canonicalSmartWallet,
    shareOFT: predicted.shareOFT,
    version: params.version,
  }

  const depositAmount = BigInt(String(phase2FinalizeParams.depositAmount ?? '0'))

  const phase1Calls: SessionCall[] = [
    {
      to: batcher,
      value: '0',
      data: encodeFunctionData({
        abi: BATCHER_PHASE1_CORE_WITH_SALT_ABI,
        functionName: 'deployPhase1CoreWithSalt',
        args: [phase1Params, phase1CodeIds, shareOftSaltOverride],
      }),
    },
    {
      to: batcher,
      value: '0',
      data: encodeFunctionData({
        abi: BATCHER_FINALIZE_PHASE1_WITH_SALT_ABI,
        functionName: 'finalizePhase1WithSalt',
        args: [phase1Params, phase1CodeIds, shareOftSaltOverride],
      }),
    },
  ]

  const phase2CoreCalls: SessionCall[] = [
    {
      to: batcher,
      value: '0',
      data: encodeFunctionData({
        abi: BATCHER_PHASE2_CORE_ABI,
        functionName: 'deployPhase2Core',
        args: [phase2CoreParams, phase2CodeIds],
      }),
    },
    {
      to: creatorToken,
      value: '0',
      data: encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [batcher, depositAmount],
      }),
    },
  ]

  const phase2FinalizeCalls: SessionCall[] = [
    {
      to: batcher,
      value: '0',
      data: encodeFunctionData({
        abi: BATCHER_FINALIZE_PHASE2_ABI,
        functionName: 'finalizePhase2',
        args: [phase2FinalizeParams],
      }),
    },
  ]

  const phase4Calls: SessionCall[] = [
    {
      to: batcher,
      value: '0',
      data: encodeFunctionData({
        abi: BATCHER_LAUNCH_DEFERRED_AUCTION_ABI,
        functionName: 'launchDeferredAuction',
        args: [phase4Params],
      }),
    },
  ]

  return {
    smartWallet: canonicalSmartWallet,
    creatorToken,
    ownerAddress: canonicalSmartWallet,
    phase1Calls,
    phase2CoreCalls,
    phase2FinalizeCalls,
    phase3Calls: [],
    phase4Calls,
    version: params.version,
    autoContinue: true,
  }
}

export async function startAkitaVaultDeployFromTelegram(params: {
  canonicalSmartWallet: Address
  version: string
}): Promise<VaultDeployStartResult> {
  try {
    const body = await buildAkitaVaultDeployStartRequest({
      canonicalSmartWallet: params.canonicalSmartWallet,
      version: params.version,
    })
    const predictedContracts = extractPredictedContractsFromFinalizeCall({
      creatorToken: body.creatorToken,
      finalizeCallData: (body.phase2FinalizeCalls[0]?.data ?? '0x') as Hex,
    })

    const token = makeSessionToken({ address: body.smartWallet })
    const origin = getCanonicalOrigin().replace(/\/+$/, '')
    const response = await fetch(`${origin}/api/deploy/v2/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: StartPayload; error?: string }
      | null
    if (!response.ok || !payload?.success || !payload.data) {
      return {
        ok: false,
        status: response.status,
        error: asTrimmed(payload?.error ?? '') || 'vault_deploy_start_failed',
      }
    }
    return {
      ok: true,
      status: response.status,
      data: {
        ...payload.data,
        predictedContracts,
      },
    }
  } catch (error: any) {
    const message = asTrimmed(String(error?.message ?? 'vault_deploy_start_failed'))
    return {
      ok: false,
      status: 500,
      error: message || 'vault_deploy_start_failed',
    }
  }
}

export async function fetchVaultDeployStatusFromTelegram(params: {
  canonicalSmartWallet: Address
  sessionId: string
}): Promise<VaultDeployStatusResult> {
  const sessionId = asTrimmed(params.sessionId)
  if (!sessionId) {
    return {
      ok: false,
      status: 400,
      error: 'missing_session_id',
    }
  }
  try {
    const smartWallet = getAddress(params.canonicalSmartWallet)
    const token = makeSessionToken({ address: smartWallet })
    const origin = getCanonicalOrigin().replace(/\/+$/, '')
    const response = await fetch(`${origin}/api/deploy/v2/session/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId }),
    })
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: StatusPayload; error?: string }
      | null
    if (!response.ok || !payload?.success || !payload.data) {
      return {
        ok: false,
        status: response.status,
        error: asTrimmed(payload?.error ?? '') || 'vault_deploy_status_failed',
      }
    }
    return {
      ok: true,
      status: response.status,
      data: payload.data,
    }
  } catch (error: any) {
    const message = asTrimmed(String(error?.message ?? 'vault_deploy_status_failed'))
    return {
      ok: false,
      status: 500,
      error: message || 'vault_deploy_status_failed',
    }
  }
}
