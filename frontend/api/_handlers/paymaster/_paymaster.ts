import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  concatHex,
  decodeFunctionData,
  encodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  getCreate2Address,
  isAddress,
  keccak256,
  toBytes,
  type Address,
  type Hex,
  } from 'viem'

import {
  getApiContracts,
  logger,
  ensureCreatorAccessSchema,
  getDb,
  isDbConfigured,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  readRequestPrincipalAddress,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'


import { DEPLOY_BYTECODE } from '../../../shared/deploy/bytecode.generated.js'
import {
  deriveCreatorCoinPolicyControllerSalt,
  derivePayoutRouterSalt,
  deriveVaultShareBurnStreamSalt,
} from '../../../shared/deploy/create2Salts.js'

import { ensureCreatorWalletsSchema } from '../../../server/_lib/wallet/creatorWallets.js'
import { getActiveDeploySessionForSender, getDeploySessionByTokenHash, hashDeployToken, signDeployToken } from '../../../server/_lib/deploy/deploySessions.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../server/_lib/db/supabaseAdmin.js'
import {
  resolveAuthorizedWalletProfile,
  resolvePersistedWalletIdentity,
  resolvePersistedWalletIdentityForProfileId,
} from '../../../server/_lib/wallet/canonicalWalletResolver.js'
import { readCustomOwnerSponsorshipToken } from '../../../server/_lib/paymaster/customOwnerSponsorshipToken.js'


import {
  resolvePayoutRouterExternalSwapApprovals,
  resolvePayoutRouterKeeperAddress,
} from '../../../server/_lib/onchain/payoutRouterRuntime.js'
import {
  gateRequestedStrategyWeights,
  resolveCreatorStrategyPlan,
} from '../../../server/_lib/creatorStrategy/resolveWeights.js'
import { deploymentBatcherNotConfiguredMessage } from '../../../server/_lib/onchain/deploymentBatcherConfigError.js'
import { assertFinalizeShareBridgeCallValue } from '../../../src/lib/deploy/finalizeShareBridgeFee.js'
import { resolveProtocolAjnaKeeperAddress } from '../../../server/_lib/wallet/protocolTreasurySafe.js'

declare const process: { env: Record<string, string | undefined> }

type JsonRpcId = string | number | null
type JsonRpcRequest = { jsonrpc?: string; id?: JsonRpcId; method?: unknown; params?: unknown }

type UserOperation = { sender?: unknown; callData?: unknown; initCode?: unknown; factory?: unknown; factoryData?: unknown }

const ALLOWED_METHODS = new Set<string>([
  // Paymaster
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  // Bundler
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
  'eth_getUserOperationReceipt',
  'eth_supportedEntryPoints',
  'eth_getUserOperationByHash',
])

const METHODS_REQUIRING_USEROP = new Set<string>([
  'pm_getPaymasterStubData',
  'pm_getPaymasterData',
  'eth_sendUserOperation',
  'eth_estimateUserOperationGas',
])
const PAYMASTER_MAX_BODY_BYTES = 512_000

const ENTRYPOINT_V06 = getAddress(`0x${'5ff137d4b0fdcd49dca30c7cf57e578a026d2789'}`)
const BASE_CHAIN_ID = 8453
const RELAY_DEPOSITORY_BASE = getAddress('0x4cd00e387622c35bddb9b4c962c136462338bc31')
const RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR = '0x49290c1c'
const ERC8004_IDENTITY_REGISTRY_DEFAULT = getAddress('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432')

// Coinbase Smart Wallet callData
const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
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
] as const

const COINBASE_SMART_WALLET_OWNER_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'isOwner', type: 'bool' }],
  },
] as const

const COINBASE_SMART_WALLET_PROVENANCE_ABI = [
  {
    type: 'function',
    name: 'entryPoint',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'implementation',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const COINBASE_SMART_WALLET_FACTORY_ABI = [
  {
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    name: 'createAccount',
    outputs: [{ name: 'account', type: 'address' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owners', type: 'bytes[]' },
      { name: 'nonce', type: 'uint256' },
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'implementation',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Minimal deployment-batcher ABI for decoding the two-step (phase1/2/3) functions.
// These functions take a tuple as the first argument, so we MUST decode via ABI (not by word offset).
const VAULT_AUXILIARY_DEPLOY_BATCHER_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Auxiliaries',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'swapRouter', type: 'address' },
          { name: 'weth', type: 'address' },
          { name: 'protocolRewards', type: 'address' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vaultShareBurnStream', type: 'bytes32' },
          { name: 'payoutRouter', type: 'bytes32' },
          { name: 'creatorCoinPolicyController', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const CREATOR_VAULT_BATCHER_PHASE_ABI = [
  {
    type: 'function',
    name: 'deployPhase1',
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
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deployPhase1WithSalt',
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
    outputs: [],
  },
  {
    type: 'function',
    name: 'deployPhase1Core',
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
    ],
    outputs: [],
  },
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
    outputs: [],
  },
  {
    type: 'function',
    name: 'finalizePhase1',
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
    ],
    outputs: [],
  },
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
    outputs: [],
  },
  {
    type: 'function',
    name: 'deployPhase2AndLaunch',
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
    outputs: [],
  },
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
    outputs: [],
  },
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'payable',
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
    outputs: [],
  },
  {
    type: 'function',
    name: 'finalizePhase2WithPermit2',
    stateMutability: 'payable',
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
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deployPhase2AndLaunchWithPermit',
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
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
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
      {
        name: 'permit',
        type: 'tuple',
        components: [
          { name: 'deadline', type: 'uint256' },
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deployPhase3Strategies',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'initialSqrtPriceX96', type: 'uint160' },
          { name: 'charmVaultName', type: 'string' },
          { name: 'charmVaultSymbol', type: 'string' },
          { name: 'ajnaVaultName', type: 'string' },
          { name: 'ajnaVaultSymbol', type: 'string' },
          { name: 'charmWeightBps', type: 'uint256' },
          { name: 'ajnaWeightBps', type: 'uint256' },
          { name: 'solanaWeightBps', type: 'uint256' },
          { name: 'ajnaBufferRatioBps', type: 'uint256' },
          { name: 'ajnaMinBucketIndex', type: 'uint256' },
          { name: 'ajnaKeeper', type: 'address' },
          { name: 'solanaKeeper', type: 'address' },
          { name: 'solanaMaxNavAge', type: 'uint64' },
          { name: 'solanaMaxNavDeltaBpsPerUpdate', type: 'uint16' },
          { name: 'solanaMinBaseLiquidityBps', type: 'uint16' },
          { name: 'solanaBridgeAddress', type: 'address' },
          { name: 'enableAutoAllocate', type: 'bool' },
          { name: 'expectedCharmProtocolFeePips', type: 'uint24' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
          { name: 'creatorCharmStrategy', type: 'bytes32' },
          { name: 'ajnaVaultAuth', type: 'bytes32' },
          { name: 'ajnaVault', type: 'bytes32' },
          { name: 'erc4626StrategyAdapter', type: 'bytes32' },
          { name: 'solanaStrategy', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
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

// Coinbase Smart Wallet factories (see viem's `toCoinbaseSmartAccount` implementation).
const COINBASE_SMART_WALLET_FACTORIES = new Set<Address>([
  getAddress(`0x${'0ba5ed0c6aa8c49038f819e587e2633c4a9f428a'}`), // v1
  getAddress(`0x${'ba5ed110efdba3d005bfc882d75358acbbb85842'}`), // v1.1
])

// Allowed inner call selectors
const SELECTOR_ERC20_APPROVE = '0x095ea7b3'
const SELECTOR_COIN_SET_PAYOUT_RECIPIENT = '0x46bb5954'
const SELECTOR_OWNABLE_TRANSFER_OWNERSHIP = '0xf2fde38b'
const SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM = '0x30f28b7a'
const SELECTOR_SWAP_ROUTER_EXECUTE = '0x3593564c' // execute(bytes,bytes[],uint256)
const SELECTOR_ZORA_SWAP_ROUTER_EXECUTE = '0x24856bc3' // execute(bytes,bytes[]) — Zora trade quotes on Universal Router
const SELECTOR_SWAP_PROXY_EXECUTE = '0x2894adf9' // execute(address,address,uint256,bytes,bytes[],uint256)
const SELECTOR_V3_SWAP_ROUTER_EXACT_INPUT_NO_DEADLINE = '0xb858183f'
const SELECTOR_V3_SWAP_ROUTER_EXACT_INPUT_SINGLE_NO_DEADLINE = '0x04e45aaf'
const SELECTOR_V3_SWAP_ROUTER_EXACT_OUTPUT_NO_DEADLINE = '0x09b81346'
const SELECTOR_V3_SWAP_ROUTER_EXACT_OUTPUT_SINGLE_NO_DEADLINE = '0x5023b4df'
const SELECTOR_WETH_DEPOSIT = '0xd0e30db0' // deposit()
const SELECTOR_V3_SWAP_ROUTER_EXACT_INPUT = '0xc04b8d59'
const SELECTOR_V3_SWAP_ROUTER_EXACT_INPUT_SINGLE = '0x414bf389'
const SELECTOR_V3_SWAP_ROUTER_EXACT_OUTPUT = '0xf28c0498'
const SELECTOR_V3_SWAP_ROUTER_EXACT_OUTPUT_SINGLE = '0xdb3e2198'
const SELECTOR_PAYOUT_ROUTER_SET_KEEPER = '0x748747e6' // setKeeper(address)
const SELECTOR_PAYOUT_ROUTER_SET_SWAP_PATH = '0xc772f341' // setSwapPath(address,bytes)
const SELECTOR_PAYOUT_ROUTER_SET_EXTERNAL_SWAP_TARGET_APPROVAL = '0x7b88bf17' // setExternalSwapTargetApproval(address,bool)
const SELECTOR_PAYOUT_ROUTER_SET_EXTERNAL_SWAP_SPENDER_APPROVAL = '0x8173e18f' // setExternalSwapSpenderApproval(address,bool)

// Coinbase Smart Wallet owner management (used for deploy sessions)
const SELECTOR_CSW_ADD_OWNER_ADDRESS = '0x0f0f3f24' // addOwnerAddress(address)
const SELECTOR_CSW_REMOVE_OWNER_AT_INDEX = '0x89625b57' // removeOwnerAtIndex(uint256,bytes)

// Two-step batcher selectors (Base)
const SELECTOR_BATCHER_DEPLOY_PHASE1 = '0x3c51ca4e'
const SELECTOR_BATCHER_DEPLOY_PHASE1_WITH_SALT = '0x297cb1e6'
const SELECTOR_BATCHER_DEPLOY_PHASE1_CORE = '0x1331378b'
const SELECTOR_BATCHER_DEPLOY_PHASE1_CORE_WITH_SALT = '0x4154f24e'
const SELECTOR_BATCHER_FINALIZE_PHASE1 = '0xa98ec9d8'
const SELECTOR_BATCHER_FINALIZE_PHASE1_WITH_SALT = '0x3bc09a8b'
const SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH = '0x9abe5eca'
const SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT = '0xe20fb0df'
const SELECTOR_BATCHER_DEPLOY_PHASE2_CORE = '0xf9344d88'
// finalizePhase2 selectors:
// - current (includes meteoraAlphaVault + solanaIxs): 0xbd4583fb
// - permit2-backed current tuple: 0xab56c176
// - compatibility (pre-Solana tuple extension): 0xcafc9348
const SELECTOR_BATCHER_FINALIZE_PHASE2 = '0xbd4583fb'
const SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2 = '0xab56c176'
const SELECTOR_BATCHER_FINALIZE_PHASE2_LEGACY = '0xcafc9348'
const SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES = '0x881d4960'
// launchDeferredAuction((address,address,address,string,uint256,uint128,bytes))
const SELECTOR_BATCHER_LAUNCH_DEFERRED_AUCTION = '0x02afdbcb'

const SELECTOR_ACTIVATION_BATCH_ACTIVATE = '0xc5c1e920'
const SELECTOR_ACTIVATION_BATCH_ACTIVATE_WITH_PERMIT2_FOR = '0xdc5de72c'

const SELECTOR_VAULT_SET_BURN_STREAM = '0xf3a1c8b6' // setBurnStream(address)
const SELECTOR_VAULT_SET_BURN_STREAM_AUTHORIZED_QUEUER = '0x7972e9ff' // setBurnStreamAuthorizedQueuer(address,bool)
const SELECTOR_VAULT_SET_WHITELIST = '0x53d6fd59' // setWhitelist(address,bool)
const SELECTOR_VAULT_SET_MINIMUM_TOTAL_IDLE = '0x8212fd43' // setMinimumTotalIdle(uint256)
const SELECTOR_VAULT_DEPLOY_TO_STRATEGIES = '0x355aa867' // deployToStrategies()
const SELECTOR_ERC8004_REGISTER = '0xf2c298be' // register(string)
const SELECTOR_ERC8004_SET_AGENT_URI = '0x0af28bd3' // setAgentURI(uint256,string)
const SELECTOR_ERC8004_SET_AGENT_WALLET = '0x2d1ef5ae' // setAgentWallet(uint256,address,uint256,bytes)
const SELECTOR_ERC8004_UNSET_AGENT_WALLET = '0x3fddcf19' // unsetAgentWallet(uint256)
const SELECTOR_ERC8004_SET_METADATA = '0x466648da' // setMetadata(uint256,string,bytes)

// ERC-8004 Reputation Registry selectors
const SELECTOR_ERC8004_GIVE_FEEDBACK = '0x3c036a7e' // giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)
const SELECTOR_ERC8004_REVOKE_FEEDBACK = '0x4ab3ca99' // revokeFeedback(uint256,uint64)
const SELECTOR_ERC8004_APPEND_RESPONSE = '0xc2349ab2' // appendResponse(uint256,address,uint64,string,bytes32)

const ALLOWED_BATCHER_SELECTORS = new Set<string>([
  SELECTOR_BATCHER_DEPLOY_PHASE1,
  SELECTOR_BATCHER_DEPLOY_PHASE1_WITH_SALT,
  SELECTOR_BATCHER_DEPLOY_PHASE1_CORE,
  SELECTOR_BATCHER_DEPLOY_PHASE1_CORE_WITH_SALT,
  SELECTOR_BATCHER_FINALIZE_PHASE1,
  SELECTOR_BATCHER_FINALIZE_PHASE1_WITH_SALT,
  SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH,
  SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT,
  SELECTOR_BATCHER_DEPLOY_PHASE2_CORE,
  SELECTOR_BATCHER_FINALIZE_PHASE2,
  SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2,
  SELECTOR_BATCHER_FINALIZE_PHASE2_LEGACY,
  SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES,
  SELECTOR_BATCHER_LAUNCH_DEFERRED_AUCTION,
])

const ALLOWED_ACTIVATION_SELECTORS = new Set<string>([
  SELECTOR_ACTIVATION_BATCH_ACTIVATE,
  SELECTOR_ACTIVATION_BATCH_ACTIVATE_WITH_PERMIT2_FOR,
])

const ALLOWED_TOKEN_SELECTORS = new Set<string>([
  SELECTOR_ERC20_APPROVE,
  SELECTOR_COIN_SET_PAYOUT_RECIPIENT,
  SELECTOR_OWNABLE_TRANSFER_OWNERSHIP,
])
const ALLOWED_PERMIT2_SELECTORS = new Set<string>([SELECTOR_PERMIT2_PERMIT_TRANSFER_FROM])
const ALLOWED_SELF_SELECTORS = new Set<string>([SELECTOR_CSW_ADD_OWNER_ADDRESS, SELECTOR_CSW_REMOVE_OWNER_AT_INDEX])
const ALLOWED_V3_SWAP_ROUTER_SELECTORS = new Set<string>([
  SELECTOR_V3_SWAP_ROUTER_EXACT_INPUT_NO_DEADLINE,
  SELECTOR_V3_SWAP_ROUTER_EXACT_INPUT_SINGLE_NO_DEADLINE,
  SELECTOR_V3_SWAP_ROUTER_EXACT_OUTPUT_NO_DEADLINE,
  SELECTOR_V3_SWAP_ROUTER_EXACT_OUTPUT_SINGLE_NO_DEADLINE,
  SELECTOR_V3_SWAP_ROUTER_EXACT_INPUT,
  SELECTOR_V3_SWAP_ROUTER_EXACT_INPUT_SINGLE,
  SELECTOR_V3_SWAP_ROUTER_EXACT_OUTPUT,
  SELECTOR_V3_SWAP_ROUTER_EXACT_OUTPUT_SINGLE,
])
const ALLOWED_ERC8004_SELECTORS = new Set<string>([
  SELECTOR_ERC8004_REGISTER,
  SELECTOR_ERC8004_SET_AGENT_URI,
  SELECTOR_ERC8004_SET_AGENT_WALLET,
  SELECTOR_ERC8004_UNSET_AGENT_WALLET,
  SELECTOR_ERC8004_SET_METADATA,
])
const ALLOWED_ERC8004_REPUTATION_SELECTORS = new Set<string>([
  SELECTOR_ERC8004_GIVE_FEEDBACK,
  SELECTOR_ERC8004_REVOKE_FEEDBACK,
  SELECTOR_ERC8004_APPEND_RESPONSE,
])

const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
  {
    type: 'function',
    name: 'addOwnerAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeOwnerAtIndex',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'index', type: 'uint256' },
      { name: 'owner', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

function asOwnerBytes(owner: Address): Hex {
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
}

function getErc8004RegistryAddress(): Address | null {
  const raw = (process.env.ERC8004_AGENT_REGISTRY ?? '').trim()
  if (raw && isAddress(raw)) return getAddress(raw)
  return ERC8004_IDENTITY_REGISTRY_DEFAULT
}

const ERC8004_REPUTATION_REGISTRY_DEFAULT = getAddress('0x8004BAa17C55a88189AE136b182e5fdA19dE9b63')

function getErc8004ReputationRegistryAddress(): Address | null {
  const raw = (process.env.ERC8004_REPUTATION_REGISTRY ?? '').trim()
  if (raw && isAddress(raw)) return getAddress(raw)
  return ERC8004_REPUTATION_REGISTRY_DEFAULT
}

function readDeploySessionHeaders(req: VercelRequest): { token: string; signature: string } | null {
  const rawToken = (req.headers?.['x-cv-deploy-session'] ?? '') as any
  const rawSig = (req.headers?.['x-cv-deploy-session-signature'] ?? '') as any
  const token = typeof rawToken === 'string' ? rawToken.trim() : ''
  const signature = typeof rawSig === 'string' ? rawSig.trim() : ''
  if (!token || !signature) return null
  return { token, signature }
}

function readCustomOwnerPolicyHeader(req: VercelRequest): string | null {
  const raw = req.headers?.['x-cv-custom-owner-policy'] ?? req.headers?.['X-CV-Custom-Owner-Policy']
  const token = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? String(raw[0] ?? '').trim() : ''
  return token || null
}

// Derive codeIds from the same generated bytecode table used by the frontend deploy builder.
// This prevents frontend/backend drift that causes `CODE_NOT_FOUND` in paymaster validation.
const PAYOUT_ROUTER_CODE_ID = keccak256(DEPLOY_BYTECODE.PayoutRouter as Hex)
const VAULT_SHARE_BURN_STREAM_CODE_ID = keccak256(DEPLOY_BYTECODE.VaultShareBurnStream as Hex)
const CREATOR_COIN_POLICY_CONTROLLER_CODE_ID = keccak256(DEPLOY_BYTECODE.CreatorCoinPolicyController as Hex)
const CREATOR_OVAULT_WRAPPER_CODE_ID = keccak256(DEPLOY_BYTECODE.CreatorOVaultWrapper as Hex)
const CREATOR_SHARE_OFT_CODE_ID = keccak256(DEPLOY_BYTECODE.CreatorShareOFT as Hex)
const OFT_BOOTSTRAP_REGISTRY_CODE_ID = keccak256(DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex)
const CREATOR_GAUGE_CONTROLLER_CODE_ID = keccak256(DEPLOY_BYTECODE.CreatorGaugeController as Hex)
const CCA_LAUNCH_STRATEGY_CODE_ID = keccak256(DEPLOY_BYTECODE.CCALaunchStrategy as Hex)
const CREATOR_ORACLE_CODE_ID = keccak256(DEPLOY_BYTECODE.CreatorOracle as Hex)
const CREATOR_CHARM_STRATEGY_CODE_ID = keccak256(DEPLOY_BYTECODE.CreatorCharmStrategy as Hex)
const AJNA_VAULT_AUTH_CODE_ID = keccak256(DEPLOY_BYTECODE.AjnaVaultAuth as Hex)
const AJNA_ERC4626_VAULT_CODE_ID = keccak256(DEPLOY_BYTECODE.AjnaERC4626Vault as Hex)
const ERC4626_STRATEGY_ADAPTER_CODE_ID = keccak256(DEPLOY_BYTECODE.ERC4626StrategyAdapter as Hex)
const SOLANA_STRATEGY_CODE_ID = keccak256(DEPLOY_BYTECODE.SolanaStrategy as Hex)
const CHARM_ALPHA_VAULT_DEPLOY_SENTINEL_CODE_ID = keccak256(toBytes('charm-factory-sentinel-v1'))

const BYTECODE_STORE_ABI = [
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ name: 'codeId', type: 'bytes32' }],
    outputs: [{ name: 'creationCode', type: 'bytes' }],
  },
] as const

const ERC20_METADATA_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

const ERC4626_ASSET_ABI = [
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const WRAPPER_VIEW_ABI = [
  { type: 'function', name: 'creatorCoin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'shareOFT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const SHARE_OFT_VIEW_ABI = [
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const LEGACY_VESTING_VIEW_ABI = [
  { type: 'function', name: 'token', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'beneficiary', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const PAYOUT_ROUTER_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setKeeper',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newKeeper', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setSwapPath',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'path', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExternalSwapTargetApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setExternalSwapSpenderApproval',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const

const SELECTOR_VESTING_RELEASE = '0x86d1a69f'
const SELECTOR_WRAPPER_UNWRAP = '0xde0e9a3e'
const SELECTOR_VAULT_REDEEM = '0xba087652'
const SELECTOR_VAULT_QUEUE = '0xd58457b2'
const SELECTOR_VAULT_CLAIM = '0x6659283e'
const SELECTOR_VAULT_SHUTDOWN = '0xe5236cc9'          // shutdownVault()
const SELECTOR_VAULT_EMERGENCY_PULL = '0x53e0cf11'    // emergencyWithdrawFromStrategies()
const SELECTOR_VAULT_EMERGENCY_WITHDRAW = '0x2f940c70' // emergencyWithdraw(uint256,address)
const LEGACY_VAULT_SELECTORS = new Set<string>([SELECTOR_VAULT_REDEEM, SELECTOR_VAULT_QUEUE, SELECTOR_VAULT_CLAIM])
const LEGACY_VAULT_EMERGENCY_SELECTORS = new Set<string>([SELECTOR_VAULT_SHUTDOWN, SELECTOR_VAULT_EMERGENCY_PULL, SELECTOR_VAULT_EMERGENCY_WITHDRAW])
/** All selectors allowed on a compatibility vault target (normal withdraw + emergency ops). */
const ALL_LEGACY_VAULT_SELECTORS = new Set<string>(
  Array.from(LEGACY_VAULT_SELECTORS).concat(Array.from(LEGACY_VAULT_EMERGENCY_SELECTORS)),
)

const CREATOR_VAULT_BATCHER_PHASE1_EVENT = [
  {
    type: 'event',
    name: 'Phase1Deployed',
    inputs: [
      { indexed: true, name: 'creatorToken', type: 'address' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'oftBootstrapRegistry', type: 'address' },
      { indexed: false, name: 'vault', type: 'address' },
      { indexed: false, name: 'wrapper', type: 'address' },
      { indexed: false, name: 'shareOFT', type: 'address' },
    ],
  },
] as const

const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const
const ZERO_ADDRESS = getAddress(`0x${'0'.repeat(40)}`)

const BASE_WETH = getAddress(`0x${'4200000000000000000000000000000000000006'}`)
const BASE_USDC = getAddress(`0x${'833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'}`)
// 4626-audit-2026-04-25 review: Zora ProtocolRewards canonical singleton on Base.
// Mirrors PayoutRouter.DEFAULT_PROTOCOL_REWARDS — see contracts/utilities/routers/PayoutRouter.sol.
// PayoutRouter accepts either `address(0)` (sentinel -> DEFAULT_PROTOCOL_REWARDS)
// or this exact address explicitly. Any other value can divert protocol-reward
// claims to an attacker-chosen contract via _claimProtocolRewards' permissive
// low-level calls, breaking accounting/claims even though the constructor's
// `code.length > 0` check would pass.
export const DEFAULT_PROTOCOL_REWARDS = getAddress(`0x${'7777777F279eba3d3Ad8F4E708545291A6fDBA8B'}`)

/**
 * 4626-audit-2026-04-25 review: validates the 7th constructor arg of a
 * sponsored PayoutRouter deploy. Returns null if accepted, otherwise an
 * error code matching the existing throw semantics.
 *
 * Extracted as an exported pure helper so the security-critical accept/reject
 * decision can be exercised directly in unit tests without mounting the full
 * paymaster mock stack.
 */
export function validatePayoutRouterProtocolRewardsArg(
  protocolRewardsArg: Address | null,
): null | 'payout_router_protocol_rewards_mismatch' {
  if (!protocolRewardsArg) return 'payout_router_protocol_rewards_mismatch'
  if (
    protocolRewardsArg !== ZERO_ADDRESS &&
    protocolRewardsArg !== DEFAULT_PROTOCOL_REWARDS
  ) {
    return 'payout_router_protocol_rewards_mismatch'
  }
  return null
}
// Uniswap Universal Router on Base (current deployment).
const BASE_UNIVERSAL_ROUTER_CURRENT = getAddress(`0x${'6ff5693b99212da76ad316178a184ab56d299b43'}`)
// Uniswap SDK swap proxy, used by Trading API routes that wrap Universal Router calls.
const UNISWAP_SWAP_PROXY_DEPLOY_ADDRESS = getAddress(`0x${'02E5be68D46DAc0B524905bfF209cf47EE6dB2a9'}`)
// Uniswap v3 SwapRouter02 on Base (exactInput/exactInputSingle).
const BASE_V3_SWAP_ROUTER = getAddress(`0x${'2626664c2603336E57B271c5C0b26F421741e481'}`)
const CREATOR_OVAULT_CODE_ID = keccak256(DEPLOY_BYTECODE.CreatorOVault as Hex)

const UNISWAP_UNIVERSAL_ROUTER_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

type InnerCall = { target: Address; value: bigint; data: Hex }

type RateLimitBucket = { count: number; resetAtMs: number }
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.PAYMASTER_SESSION_RATE_LIMIT_WINDOW_MS ?? '', 10) || 60_000
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.PAYMASTER_SESSION_RATE_LIMIT_MAX_REQUESTS ?? '', 10) || 120
const rateLimitBuckets: Map<string, RateLimitBucket> = new Map()

// FIX: FINDING-05 — per-sender UserOp sponsorship limit to prevent gas budget exhaustion.
// Tracks sponsored UserOps per sender address within a sliding window.
// In-memory Map with TTL; sufficient for single-instance rate limiting, complements
// the per-IP rate limit above. For full distributed enforcement, use a shared store.
type SponsorshipBucket = { count: number; resetAtMs: number }
const SPONSORSHIP_WINDOW_MS = Number.parseInt(process.env.PAYMASTER_SPONSORSHIP_WINDOW_MS ?? '', 10) || 3_600_000 // 1 hour
const SPONSORSHIP_MAX_OPS_PER_SENDER = Number.parseInt(process.env.PAYMASTER_SPONSORSHIP_MAX_OPS_PER_SENDER ?? '', 10) || 120
const sponsorshipBuckets: Map<string, SponsorshipBucket> = new Map()

function sponsorshipWeightForMethod(method: string): number {
  // A single visible UserOp can make several read/preflight RPCs. Only count
  // calls that either issue final paymaster data or submit the sponsored op.
  if (method === 'pm_getPaymasterData') return 1
  if (method === 'eth_sendUserOperation') return 1
  return 0
}

function checkSponsorshipLimit(sender: string, weight = 1): { allowed: boolean; resetAtMs: number } {
  if (weight <= 0) return { allowed: true, resetAtMs: Date.now() + SPONSORSHIP_WINDOW_MS }
  const key = sender.toLowerCase()
  const now = Date.now()
  const bucket = sponsorshipBuckets.get(key)
  if (!bucket || now >= bucket.resetAtMs) {
    const resetAtMs = now + SPONSORSHIP_WINDOW_MS
    sponsorshipBuckets.set(key, { count: weight, resetAtMs })
    return { allowed: true, resetAtMs }
  }
  if (bucket.count + weight > SPONSORSHIP_MAX_OPS_PER_SENDER) {
    return { allowed: false, resetAtMs: bucket.resetAtMs }
  }
  bucket.count += weight
  return { allowed: true, resetAtMs: bucket.resetAtMs }
}

// Periodically clean up expired sponsorship buckets to prevent memory leaks.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of sponsorshipBuckets) {
    if (now >= bucket.resetAtMs) sponsorshipBuckets.delete(key)
  }
}, 5 * 60_000)

let _baseClient: any | null = null
async function getBaseClient() {
  if (_baseClient) return _baseClient
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')

  const rpc = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  _baseClient = createPublicClient({
    chain: base,
    transport: http(rpc, { timeout: 12_000 }),
  })
  return _baseClient
}

type AllowlistMode = 'disabled' | 'enforced'

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  const parts = raw
    .split(/[\s,]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const out = new Set<string>()
  for (const p of parts) {
    if (!isAddress(p)) continue
    out.add(p.toLowerCase())
  }
  return out
}

function normalizeAddresses(input: Array<Address | string | null | undefined>): Address[] {
  const out = new Set<string>()
  for (const a of input) {
    if (!a || typeof a !== 'string') continue
    if (!isAddress(a)) continue
    out.add(getAddress(a).toLowerCase())
  }
  return Array.from(out).map((a) => getAddress(a as Address))
}

function buildSupabaseOrFilters(fields: string[], addresses: string[]): string {
  return addresses.flatMap((addr) => fields.map((f) => `${f}.ilike.${addr}`)).join(',')
}

async function resolveAllowlistAddresses(params: { sessionAddress: Address; creatorToken?: Address | null }): Promise<Address[]> {
  const base = normalizeAddresses([params.sessionAddress])
  return base
}

async function checkCswOwnership(sessionAddress: Address, cswAddress: Address): Promise<boolean> {
  try {
    const client = await getBaseClient()
    const isOwner = await client.readContract({
      address: cswAddress,
      abi: COINBASE_SMART_WALLET_OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [sessionAddress],
    })
    return Boolean(isOwner)
  } catch {
    return false
  }
}

async function isCreatorAllowlisted(params: {
  sessionAddress: Address
  creatorToken?: Address | null
}): Promise<{ mode: AllowlistMode; allowed: boolean }> {
  const addr = params.sessionAddress.toLowerCase()
  const addressesToCheck = await resolveAllowlistAddresses({ sessionAddress: params.sessionAddress, creatorToken: params.creatorToken })
  const addressFilters = addressesToCheck.map((a) => a.toLowerCase())

  if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    try {
      // Check allowlist first (direct address or CSW match)
      const allowlistedRes = await supabase
        .from('allowlist')
        .select('address')
        .or(buildSupabaseOrFilters(['address', 'csw_address'], addressFilters))
        .is('revoked_at', null)
        .limit(1)
      if (!allowlistedRes.error && Array.isArray(allowlistedRes.data) && allowlistedRes.data.length > 0) {
        return { mode: 'enforced', allowed: true }
      }

      // Check if session is owner of any allowlisted CSW (on-chain check)
      const cswRes = await supabase
        .from('allowlist')
        .select('csw_address')
        .not('csw_address', 'is', null)
        .is('revoked_at', null)
        .limit(50)
      if (!cswRes.error && Array.isArray(cswRes.data) && cswRes.data.length > 0) {
        for (const row of cswRes.data) {
          const csw = row.csw_address as string
          if (csw && isAddress(csw)) {
            const isOwner = await checkCswOwnership(params.sessionAddress, getAddress(csw))
            if (isOwner) return { mode: 'enforced', allowed: true }
          }
        }
      }

      // Check creator_wallets (linked wallets)
      const linkedRes = await supabase
        .from('creator_wallets')
        .select('wallet_address')
        .or(buildSupabaseOrFilters(['wallet_address'], addressFilters))
        .limit(1)
      if (!linkedRes.error && Array.isArray(linkedRes.data) && linkedRes.data.length > 0) {
        return { mode: 'enforced', allowed: true }
      }

      // If all checks passed without errors but no match, user is not allowed
      return { mode: 'enforced', allowed: false }
    } catch {
      throw new Error('allowlist_check_failed')
    }
  }

  if (isDbConfigured()) {
    const db = await getDb()
    if (!db) throw new Error('allowlist_check_failed')
    await ensureCreatorAccessSchema()
    if (!db.query || typeof (db as any).sql !== 'function') throw new Error('allowlist_check_failed')
    // Mirror `/api/creator-allowlist`: deploy requires an explicit allowlist or linked-wallet match.
    try {
      await ensureCreatorWalletsSchema(db as any)
    } catch {
      // Don't block everything if optional tables are unavailable; fall back to allowlist-only.
    }

    // Check direct address match
    const allowlistedQ = await db.query(
      `SELECT address FROM allowlist
       WHERE (LOWER(address) = ANY($1) OR LOWER(csw_address) = ANY($1))
         AND revoked_at IS NULL
       LIMIT 1;`,
      [addressFilters],
    )
    if (Array.isArray(allowlistedQ.rows) && allowlistedQ.rows.length > 0) {
      return { mode: 'enforced', allowed: true }
    }

    // Check CSW ownership (session is owner of an allowlisted CSW)
    const cswQ = await db.query(
      `SELECT csw_address FROM allowlist WHERE csw_address IS NOT NULL AND revoked_at IS NULL LIMIT 50;`,
      [],
    )
    if (Array.isArray(cswQ.rows)) {
      for (const row of cswQ.rows) {
        const csw = row.csw_address as string
        if (csw && isAddress(csw)) {
          const isOwner = await checkCswOwnership(params.sessionAddress, getAddress(csw))
          if (isOwner) return { mode: 'enforced', allowed: true }
        }
      }
    }

    // Check linked wallets
    const linkedQ = await db.query(
      `SELECT wallet_address FROM creator_wallets WHERE LOWER(wallet_address) = ANY($1) LIMIT 1;`,
      [addressFilters],
    ).catch(() => ({ rows: [] }))
    if (Array.isArray(linkedQ.rows) && linkedQ.rows.length > 0) {
      return { mode: 'enforced', allowed: true }
    }

    return { mode: 'enforced', allowed: false }
  }

  // Fallback (no DB): env allowlist (compatibility/simple).
  const allowlist = parseAllowlist(process.env.CREATOR_ALLOWLIST)
  const mode: AllowlistMode = allowlist.size > 0 ? 'enforced' : 'disabled'
  const allowed = mode === 'disabled' ? true : allowlist.has(addr)
  return { mode, allowed }
}

async function assertCreatorAllowlisted(params: { sessionAddress: Address; creatorToken?: Address | null }): Promise<void> {
  const { mode, allowed } = await isCreatorAllowlisted(params)
  if (mode === 'enforced' && !allowed) throw new Error('not_allowlisted')
}

function normalizeSponsoredInnerCalls(
  calls: Array<{ to: Address; value: bigint; data: Hex }>,
): InnerCall[] {
  return calls.map((call) => ({
    target: getAddress(call.to),
    value: BigInt(call.value),
    data: call.data,
  }))
}

function isRelayPart1DepositoryInnerCall(call: InnerCall): boolean {
  return (
    getAddress(call.target) === RELAY_DEPOSITORY_BASE &&
    getSelector(call.data) === RELAY_DEPOSITORY_NATIVE_DEPOSIT_SELECTOR &&
    call.value > 0n
  )
}

function assertRelayOwnerInstallPart1InnerCalls(params: {
  sender: Address
  innerCalls: InnerCall[]
  customOwnerSponsorship: {
    smartWalletAddress: Address
  }
}): void {
  if (getAddress(params.sender) !== getAddress(params.customOwnerSponsorship.smartWalletAddress)) {
    throw new Error('custom_owner_policy_sender_mismatch')
  }
  if (params.innerCalls.length !== 1) throw new Error('relay_part1_call_count_invalid')
  const only = params.innerCalls[0]
  if (!only || !isRelayPart1DepositoryInnerCall(only)) {
    throw new Error('relay_part1_call_shape_invalid')
  }
}

function decodeSmartWalletInnerCalls(callData: Hex): Array<{ to: Address; value: bigint; data: Hex }> {
  const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_ABI, data: callData })
  if (decoded.functionName === 'execute') {
    return [
      {
        to: getAddress(decoded.args[0] as Address),
        value: decoded.args[1] as bigint,
        data: decoded.args[2] as Hex,
      },
    ]
  }
  if (decoded.functionName === 'executeBatch') {
    return (decoded.args[0] as any[]).map((call: any) => ({
      to: getAddress(call.target as Address),
      value: BigInt(call.value),
      data: call.data as Hex,
    }))
  }
  throw new Error('smart_wallet_call_not_allowed')
}

function encodeSmartWalletCallDataFromInnerCalls(innerCalls: InnerCall[]): Hex {
  if (innerCalls.length === 1) {
    const only = innerCalls[0]
    return encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'execute',
      args: [only.target, only.value, only.data],
    })
  }
  return encodeFunctionData({
    abi: COINBASE_SMART_WALLET_ABI,
    functionName: 'executeBatch',
    args: [innerCalls.map((call) => ({ target: call.target, value: call.value, data: call.data }))],
  })
}

export async function validateSponsoredSmartWalletCalls(params: {
  sender: Address
  sessionAddress: Address
  calls: Array<{ to: Address; value: bigint; data: Hex }>
  deploySessionOwner?: Address | null
  canonicalEmbeddedOwner?: Address | null
  customOwnerPolicyToken?: string | null
  allowCleanupOnlyForInactiveDeploySession?: boolean
  initCode?: Hex | null
  factory?: Address | null
  factoryData?: Hex | null
  debug?: (info: {
    deployer: Address
    storeEnv: Address | null
    storeFromDeployer: Address | null
    storeUsed: Address
    expectedVault?: Address | null
    expectedBurnStream?: Address | null
    expectedPayoutRouter?: Address | null
    expectedCreatorCoinPolicyController?: Address | null
    payoutRouterBurnStreamArg?: Address | null
    vaultBurnStreamArg?: Address | null
  }) => void
}): Promise<{ expectedCreatorToken: Address | null; mode: string }> {
  const innerCalls = normalizeSponsoredInnerCalls(params.calls)
  if (innerCalls.length === 0) throw new Error('no_inner_calls')

  const deploySessionOwner =
    params.deploySessionOwner && isAddress(params.deploySessionOwner)
      ? getAddress(params.deploySessionOwner)
      : null
  const customOwnerPolicyToken =
    typeof params.customOwnerPolicyToken === 'string' && params.customOwnerPolicyToken.trim()
      ? params.customOwnerPolicyToken.trim()
      : null
  const customOwnerSponsorship = customOwnerPolicyToken
    ? readCustomOwnerSponsorshipToken(customOwnerPolicyToken)
    : null
  if (customOwnerPolicyToken && !customOwnerSponsorship) {
    throw new Error('custom_owner_policy_invalid')
  }
  if (customOwnerSponsorship) {
    if (customOwnerSponsorship.sessionAddress !== params.sessionAddress) {
      throw new Error('custom_owner_policy_session_mismatch')
    }
    if (customOwnerSponsorship.smartWalletAddress !== params.sender) {
      throw new Error('custom_owner_policy_sender_mismatch')
    }
    const relayPart1Only =
      innerCalls.length === 1 && isRelayPart1DepositoryInnerCall(innerCalls[0]!)
    if (relayPart1Only) {
      assertRelayOwnerInstallPart1InnerCalls({
        sender: params.sender,
        innerCalls,
        customOwnerSponsorship,
      })
      const client = await getBaseClient()
      await assertSenderCoinbaseSmartWalletProvenance({ client, sender: params.sender })
      return { expectedCreatorToken: null, mode: 'relay_owner_install_part1' }
    }
  }

  if (!customOwnerSponsorship) {
    await assertSessionOwnsSender({
      sender: params.sender,
      sessionAddress: params.sessionAddress,
      initCode: params.initCode ?? null,
      factory: params.factory ?? null,
      factoryData: params.factoryData ?? null,
    })
  }

  if (deploySessionOwner) {
    const client = await getBaseClient()
    const ownerInstalled = await client.readContract({
      address: params.sender,
      abi: COINBASE_SMART_WALLET_OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [deploySessionOwner],
    })
    if (!ownerInstalled) throw new Error('deploy_session_owner_not_installed')
  }

  if (params.allowCleanupOnlyForInactiveDeploySession) {
    if (!deploySessionOwner) throw new Error('deploy_session_missing')
    for (const call of innerCalls) {
      if (call.value !== 0n) throw new Error('value_transfer_not_allowed')
      if (call.target !== params.sender) throw new Error('cleanup_only_violation')
      if (getSelector(call.data) !== SELECTOR_CSW_REMOVE_OWNER_AT_INDEX) throw new Error('cleanup_only_violation')
      const decodedSelf = decodeFunctionData({ abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI, data: call.data })
      if (decodedSelf.functionName !== 'removeOwnerAtIndex') throw new Error('cleanup_only_violation')
      const ownerBytes = decodedSelf.args[1] as Hex
      const expected = asOwnerBytes(deploySessionOwner)
      if (String(ownerBytes).toLowerCase() !== String(expected).toLowerCase()) {
        throw new Error('deploy_session_owner_mismatch')
      }
    }
    return { expectedCreatorToken: null, mode: 'cleanup_only' }
  }

  const callData = encodeSmartWalletCallDataFromInnerCalls(innerCalls)
  const validated = await validateInnerCalls({
    sender: params.sender,
    sessionAddress: params.sessionAddress,
    callData,
    deploySessionOwner,
    canonicalEmbeddedOwner: params.canonicalEmbeddedOwner ?? null,
    customOwnerSponsorship,
    debug: params.debug,
  })
  if (validated.mode !== 'deploy_session_setup' && validated.mode !== 'relay_owner_install_part1') {
    await assertCreatorAllowlisted({
      sessionAddress: params.sessionAddress,
      creatorToken: validated.expectedCreatorToken,
    })
  }
  return validated
}

function jsonRpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function getFirstRequestId(requests: JsonRpcRequest[]): JsonRpcId {
  return (requests[0] as any)?.id ?? null
}

function isSupportedEntryPointsProbe(requests: JsonRpcRequest[]): boolean {
  return requests.length === 1 && requests[0]?.method === 'eth_supportedEntryPoints'
}

function getCdpEndpoint(): string | null {
  const v =
    (process.env.CDP_PAYMASTER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_URL ?? '').trim() ||
    (process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT ?? '').trim() ||
    // Back-compat with repo root .env.example naming
    (process.env.PAYMASTER_URL ?? '').trim() ||
    (process.env.BUNDLER_URL ?? '').trim()
  return v.length > 0 ? v : null
}

function isRequestArray(body: unknown): body is JsonRpcRequest[] {
  return Array.isArray(body)
}

function isRequestObject(body: unknown): body is JsonRpcRequest {
  return !!body && typeof body === 'object' && !Array.isArray(body)
}

function isHexString(v: unknown): v is Hex {
  return typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v)
}

function getSelector(data: Hex): string {
  return data.length >= 10 ? data.slice(0, 10).toLowerCase() : ''
}

async function resolveCanonicalEmbeddedOwnerForSender(params: {
  sessionAddress: Address
  sender: Address
  calls: Array<{ target?: Address; to?: Address; data: Hex }>
}): Promise<Address | null> {
  const hasAddOwnerSelfCall = params.calls.some(
    (call) => {
      const callTarget = call.target ?? call.to
      return !!callTarget && getAddress(callTarget) === params.sender && getSelector(call.data) === SELECTOR_CSW_ADD_OWNER_ADDRESS
    },
  )
  if (!hasAddOwnerSelfCall) return null

  const resolveEmbeddedOwner = (identity: Awaited<ReturnType<typeof resolvePersistedWalletIdentity>>): Address | null => {
    if (!identity?.canonicalSmartWallet || !identity.embeddedEoa) return null
    try {
      const canonical = getAddress(identity.canonicalSmartWallet)
      if (canonical !== params.sender) return null
      return getAddress(identity.embeddedEoa)
    } catch {
      return null
    }
  }

  // Prefer sender-bound identity (canonical CSW), then fall back to session identity.
  const senderIdentity = await resolvePersistedWalletIdentity(params.sender)
  const senderBoundEmbeddedOwner = resolveEmbeddedOwner(senderIdentity)
  if (senderBoundEmbeddedOwner) return senderBoundEmbeddedOwner

  const sessionIdentity = await resolvePersistedWalletIdentity(params.sessionAddress)
  const sessionBoundEmbeddedOwner = resolveEmbeddedOwner(sessionIdentity)
  if (sessionBoundEmbeddedOwner) return sessionBoundEmbeddedOwner

  // Some sessions resolve to profile owner wallets that are not canonical/embedded addresses.
  // In that case, resolve profile authority first, then map to canonical persisted identity.
  const authority = await resolveAuthorizedWalletProfile(params.sessionAddress)
  if (!authority?.canonicalSmartWalletAddress) return null
  if (Number.isFinite(authority.profileId) && authority.profileId > 0) {
    const authorityProfileIdentity = await resolvePersistedWalletIdentityForProfileId(authority.profileId)
    const authorityProfileEmbeddedOwner = resolveEmbeddedOwner(authorityProfileIdentity)
    if (authorityProfileEmbeddedOwner) return authorityProfileEmbeddedOwner
  }
  const authorityCanonicalIdentity = await resolvePersistedWalletIdentity(authority.canonicalSmartWalletAddress)
  return resolveEmbeddedOwner(authorityCanonicalIdentity)
}

function assertCanonicalSwapRouterExecuteEncoding(data: Hex): void {
  let decoded: any
  try {
    decoded = decodeFunctionData({
      abi: UNISWAP_UNIVERSAL_ROUTER_ABI,
      data,
    })
  } catch {
    throw new Error('swap_router_decode_failed')
  }

  if (decoded.functionName !== 'execute') {
    throw new Error('swap_router_selector_not_allowed')
  }

  const canonicalData = encodeFunctionData({
    abi: UNISWAP_UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: decoded.args,
  })

  if (canonicalData.toLowerCase() !== data.toLowerCase()) {
    throw new Error('swap_router_non_canonical_encoding')
  }
}

// Universal Router command opcodes allowed for paymaster-sponsored swaps.
// See https://docs.uniswap.org/contracts/universal-router/technical-reference
const ALLOWED_SWAP_COMMAND_OPCODES = new Set<number>([
  0x00, // V3_SWAP_EXACT_IN
  0x01, // V3_SWAP_EXACT_OUT
  0x08, // V2_SWAP_EXACT_IN
  0x09, // V2_SWAP_EXACT_OUT
  0x10, // V4_SWAP
  0x0b, // WRAP_ETH
  0x0c, // UNWRAP_ETH
])

function assertSwapRouterPayloadReferencesToken(data: Hex, token: Address): void {
  let decoded: any
  try {
    decoded = decodeFunctionData({
      abi: UNISWAP_UNIVERSAL_ROUTER_ABI,
      data,
    })
  } catch {
    throw new Error('swap_router_decode_failed')
  }

  if (decoded.functionName !== 'execute') {
    throw new Error('swap_router_selector_not_allowed')
  }

  const commands = decoded.args[0] as Hex
  const inputs = decoded.args[1] as Hex[]
  const commandBytes =
    typeof commands === 'string' && commands.startsWith('0x')
      ? Math.max(0, Math.floor((commands.length - 2) / 2))
      : 0
  if (commandBytes === 0) throw new Error('swap_router_empty_commands')
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length !== commandBytes) {
    throw new Error('swap_router_inputs_mismatch')
  }

  for (let i = 0; i < commandBytes; i++) {
    const opcode = parseInt(commands.slice(2 + i * 2, 2 + i * 2 + 2), 16)
    if (!ALLOWED_SWAP_COMMAND_OPCODES.has(opcode & 0x3f)) {
      throw new Error('swap_router_command_not_allowed')
    }
  }

  const tokenNeedle = token.slice(2).toLowerCase()
  const referencesToken = inputs.some((input) => {
    if (typeof input !== 'string') return false
    return input.toLowerCase().includes(tokenNeedle)
  })
  if (!referencesToken) throw new Error('swap_router_token_not_referenced')
}

function assertRawSwapPayloadReferencesToken(data: Hex, token: Address): void {
  const tokenNeedle = token.slice(2).toLowerCase()
  if (!data.toLowerCase().includes(tokenNeedle)) throw new Error('swap_router_token_not_referenced')
}

function resolveSwapInputTokenFromRouterCalldata(
  data: Hex,
  candidates: Address[],
): Address | null {
  for (const token of candidates) {
    try {
      assertRawSwapPayloadReferencesToken(data, token)
      return token
    } catch {
      // try next candidate
    }
  }
  return null
}

function summarizeSmartWalletCallData(callData: Hex): {
  innerCallCount: number
  innerSelectors: string[]
  innerTargets: Address[]
} | null {
  try {
    const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_ABI, data: callData })
    const innerCalls: InnerCall[] =
      decoded.functionName === 'execute'
        ? [
            {
              target: getAddress(decoded.args[0] as Address),
              value: decoded.args[1] as bigint,
              data: decoded.args[2] as Hex,
            },
          ]
        : decoded.functionName === 'executeBatch'
          ? (decoded.args[0] as any[]).map((c: any) => ({
              target: getAddress(c.target as Address),
              value: BigInt(c.value),
              data: c.data as Hex,
            }))
          : []

    const selectors = innerCalls.map((c) => getSelector(c.data)).filter(Boolean)
    const targets = innerCalls.map((c) => c.target)
    return {
      innerCallCount: innerCalls.length,
      innerSelectors: selectors,
      innerTargets: targets,
    }
  } catch {
    return null
  }
}

function formatValidationContexts(
  contexts: Array<{
    method: string
    sender?: Address | null
    mode?: string | null
    expectedCreatorToken?: Address | null
    innerSelectors?: string[]
    innerTargets?: Address[]
  }>,
): string {
  const compact = contexts.slice(0, 3).map((ctx, idx) => {
    const selectors = (ctx.innerSelectors ?? []).slice(0, 3).join(',') || 'none'
    const targets = (ctx.innerTargets ?? []).slice(0, 2).join(',') || 'none'
    return [
      `#${idx + 1}`,
      `method=${ctx.method}`,
      `mode=${ctx.mode ?? 'unknown'}`,
      `sender=${ctx.sender ?? 'unknown'}`,
      `creatorToken=${ctx.expectedCreatorToken ?? 'none'}`,
      `selectors=${selectors}`,
      `targets=${targets}`,
    ].join(';')
  })
  return compact.join(' | ')
}

function decodeAddressArgFromCalldata(data: Hex, argIndex: number): Address | null {
  // abi.encodeWithSelector packs selector (4) + each arg in 32 byte slots
  const start = 10 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  const addr = `0x${word.slice(24)}` // last 20 bytes
  if (!isAddress(addr)) return null
  return getAddress(addr)
}

function decodeUint256ArgFromCalldata(data: Hex, argIndex: number): bigint | null {
  const start = 10 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  try {
    return BigInt(`0x${word}`)
  } catch {
    return null
  }
}

function decodeAddressFromPackedPath(path: Hex, byteOffset: number): Address | null {
  if (!isHexString(path)) return null
  const totalBytes = Math.max(0, Math.floor((path.length - 2) / 2))
  if (byteOffset < 0 || byteOffset + 20 > totalBytes) return null
  const start = 2 + byteOffset * 2
  const end = start + 40
  const raw = `0x${path.slice(start, end)}`
  if (!isAddress(raw)) return null
  return getAddress(raw)
}

function decodeBoolArgFromCalldata(data: Hex, argIndex: number): boolean | null {
  const start = 10 + argIndex * 64
  const word = data.slice(start, start + 64)
  if (word.length !== 64) return null
  try {
    const v = BigInt(`0x${word}`)
    if (v === 0n) return false
    if (v === 1n) return true
    // Non-canonical bool encoding; treat as invalid.
    return null
  } catch {
    return null
  }
}

function abiEncodeAddresses(addrs: Address[]): Hex {
  // abi.encode(address...) (static types only)
  // Each address is left-padded to 32 bytes.
  let out = '0x'
  for (const a of addrs) {
    const hex = a.toLowerCase().replace(/^0x/, '')
    // Address is 20 bytes; ABI-encoding pads to 32 bytes with 12 leading zero bytes.
    out += '0'.repeat(12 * 2) + hex
  }
  return out as Hex
}

const _creationCodeCache: Map<string, Hex> = new Map()

async function getCreationCodeFromStore(params: { store: Address; codeId: Hex }): Promise<Hex> {
  const key = `${params.store.toLowerCase()}:${params.codeId.toLowerCase()}`
  const cached = _creationCodeCache.get(key)
  if (cached) return cached
  const client = await getBaseClient()
  const code = (await client.readContract({
    address: params.store,
    abi: BYTECODE_STORE_ABI,
    functionName: 'get',
    args: [params.codeId],
  })) as Hex
  _creationCodeCache.set(key, code)
  return code
}

async function computeCreate2AddressFromStore(params: {
  store: Address
  deployer: Address
  salt: Hex
  codeId: Hex
  constructorArgs: Hex
}): Promise<Address> {
  const creationCode = await getCreationCodeFromStore({ store: params.store, codeId: params.codeId })
  const initCodeHash = keccak256(concatHex([creationCode, params.constructorArgs]))
  return getCreate2Address({ from: params.deployer, salt: params.salt, bytecodeHash: initCodeHash })
}

function enforceRateLimit(key: string, weight = 1) {
  if (weight <= 0) return
  const now = Date.now()
  const cur = rateLimitBuckets.get(key)
  if (!cur || now >= cur.resetAtMs) {
    rateLimitBuckets.set(key, { count: weight, resetAtMs: now + RATE_LIMIT_WINDOW_MS })
    return
  }
  cur.count += weight
  if (cur.count > RATE_LIMIT_MAX_REQUESTS) {
    throw new Error('rate_limited')
  }
}

function parseChainId(chainIdRaw: unknown): number | null {
  if (typeof chainIdRaw === 'number' && Number.isFinite(chainIdRaw)) return chainIdRaw
  if (typeof chainIdRaw === 'string') {
    const s = chainIdRaw.trim().toLowerCase()
    if (s.startsWith('0x')) {
      try {
        return Number(BigInt(s))
      } catch {
        return null
      }
    }
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }
  return null
}

function extractUserOpAndEntryPoint(method: string, params: unknown): { userOp: UserOperation; entryPoint: Address; chainId: number | null } | null {
  if (!Array.isArray(params) || params.length < 2) return null
  const userOp = (params[0] ?? {}) as UserOperation
  const entryPointRaw = params[1]
  const chainIdRaw = method === 'pm_getPaymasterStubData' || method === 'pm_getPaymasterData' ? params[2] : null
  const chainId = parseChainId(chainIdRaw)
  if (typeof entryPointRaw !== 'string' || !isAddress(entryPointRaw)) return null
  return { userOp, entryPoint: getAddress(entryPointRaw), chainId }
}

async function readAllowedCoinbaseSmartWalletImplementations(client: Awaited<ReturnType<typeof getBaseClient>>): Promise<Set<Address>> {
  const implementationResults = await Promise.all(
    Array.from(COINBASE_SMART_WALLET_FACTORIES).map((factory) =>
      client
        .readContract({
          address: factory,
          abi: COINBASE_SMART_WALLET_FACTORY_ABI,
          functionName: 'implementation',
        })
        .catch(() => null),
    ),
  )
  const implementations = new Set<Address>()
  for (const candidate of implementationResults) {
    if (candidate && isAddress(candidate)) implementations.add(getAddress(candidate))
  }
  if (implementations.size === 0) throw new Error('csw_factory_implementation_unavailable')
  return implementations
}

async function assertSenderCoinbaseSmartWalletProvenance(params: {
  client: Awaited<ReturnType<typeof getBaseClient>>
  sender: Address
}) {
  const [entryPointRaw, implementationRaw, allowedImplementations] = await Promise.all([
    params.client
      .readContract({
        address: params.sender,
        abi: COINBASE_SMART_WALLET_PROVENANCE_ABI,
        functionName: 'entryPoint',
      })
      .catch(() => null),
    params.client
      .readContract({
        address: params.sender,
        abi: COINBASE_SMART_WALLET_PROVENANCE_ABI,
        functionName: 'implementation',
      })
      .catch(() => null),
    readAllowedCoinbaseSmartWalletImplementations(params.client),
  ])

  if (!entryPointRaw || !isAddress(entryPointRaw) || getAddress(entryPointRaw) !== ENTRYPOINT_V06) {
    throw new Error('sender_entrypoint_not_allowed')
  }
  if (!implementationRaw || !isAddress(implementationRaw)) throw new Error('sender_implementation_missing')
  const implementation = getAddress(implementationRaw)
  if (!allowedImplementations.has(implementation)) {
    throw new Error('sender_implementation_not_allowed')
  }
}

function matchesPhase1DeployedLog(
  log: any,
  expected: {
    vault: Address
    wrapper?: Address | null
    shareOFT?: Address | null
  },
): boolean {
  const vault = log?.args?.vault
  if (!vault || !isAddress(vault) || getAddress(vault) !== getAddress(expected.vault)) return false

  if (expected.wrapper) {
    const wrapper = log?.args?.wrapper
    if (!wrapper || !isAddress(wrapper) || getAddress(wrapper) !== getAddress(expected.wrapper)) return false
  }

  if (expected.shareOFT) {
    const shareOft = log?.args?.shareOFT
    if (!shareOft || !isAddress(shareOft) || getAddress(shareOft) !== getAddress(expected.shareOFT)) return false
  }

  return true
}

async function assertSessionOwnsSender(params: { sender: Address; sessionAddress: Address; initCode: Hex | null; factory?: Address | null; factoryData?: Hex | null }) {
  const client = await getBaseClient()

  // Deployed accounts: verify onchain ownership.
  const code = await client.getBytecode({ address: params.sender })
  if (code && code !== '0x') {
    await assertSenderCoinbaseSmartWalletProvenance({ client, sender: params.sender })
    // Self-authenticated CSW sessions (session principal equals sender CSW) are valid.
    // In this case, isOwnerAddress(sender) may be false because CSW is not an owner of itself.
    if (getAddress(params.sessionAddress) === getAddress(params.sender)) return
    const isOwner = await client.readContract({
      address: params.sender,
      abi: COINBASE_SMART_WALLET_OWNER_ABI,
      functionName: 'isOwnerAddress',
      args: [params.sessionAddress],
    })
    if (!isOwner) throw new Error('not_owner')
    return
  }

  // Counterfactual accounts: validate initCode against known Coinbase factory + owners.
  const initCode = params.initCode
  if (!initCode || initCode === '0x') throw new Error('sender_not_deployed')
  if (!isHexString(initCode) || initCode.length < 42) throw new Error('invalid_init_code')

  const factoryRaw = initCode.slice(0, 42)
  if (!isAddress(factoryRaw)) throw new Error('invalid_factory')
  const factory = getAddress(factoryRaw)
  if (!COINBASE_SMART_WALLET_FACTORIES.has(factory)) throw new Error('factory_not_allowed')

  const factoryData = (`0x${initCode.slice(42)}` || '0x') as Hex
  const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_FACTORY_ABI, data: factoryData })
  if (decoded.functionName !== 'createAccount') throw new Error('factory_calldata_not_allowed')

  const owners = decoded.args[0] as readonly Hex[]
  const nonce = decoded.args[1] as bigint
  const sessionLc = params.sessionAddress.toLowerCase().slice(2)
  const hasOwner = owners.some((o) => typeof o === 'string' && o.toLowerCase().startsWith('0x') && o.toLowerCase().slice(-40) === sessionLc)
  if (!hasOwner) throw new Error('not_owner')

  const expected = await client.readContract({
    address: factory,
    abi: COINBASE_SMART_WALLET_FACTORY_ABI,
    functionName: 'getAddress',
    args: [owners as any, nonce],
  })
  if (getAddress(expected as Address) !== params.sender) throw new Error('sender_address_mismatch')
}

async function validateInnerCalls(params: {
  sender: Address
  sessionAddress: Address
  callData: Hex
  deploySessionOwner?: Address | null
  canonicalEmbeddedOwner?: Address | null
  customOwnerSponsorship?: {
    sessionAddress: Address
    smartWalletAddress: Address
    ownerToAdd: Address
  } | null
  debug?: (info: {
    deployer: Address
    storeEnv: Address | null
    storeFromDeployer: Address | null
    storeUsed: Address
    expectedVault?: Address | null
    expectedBurnStream?: Address | null
    expectedPayoutRouter?: Address | null
    expectedCreatorCoinPolicyController?: Address | null
    payoutRouterBurnStreamArg?: Address | null
    vaultBurnStreamArg?: Address | null
  }) => void
}): Promise<{ expectedCreatorToken: Address | null; mode: string }> {
  const contracts = getApiContracts()
  const expectedPayoutRouterKeeper = resolvePayoutRouterKeeperAddress()
  const expectedPayoutRouterExternalApprovals = resolvePayoutRouterExternalSwapApprovals()
  const expectedPayoutRouterExternalTargets = new Set<Address>(
    expectedPayoutRouterExternalApprovals.targets.map((target) => getAddress(target)),
  )
  const expectedPayoutRouterExternalSpenders = new Set<Address>(
    expectedPayoutRouterExternalApprovals.spenders.map((spender) => getAddress(spender)),
  )
  const expectedZoraToken = contracts.zora && isAddress(contracts.zora) ? getAddress(contracts.zora) : null
  const expectedWethToken = contracts.weth && isAddress(contracts.weth) ? getAddress(contracts.weth) : BASE_WETH
  const expectedProtocolTreasury =
    contracts.protocolTreasury && isAddress(contracts.protocolTreasury) ? getAddress(contracts.protocolTreasury) : null
  const expectedProtocolAjnaKeeper = resolveProtocolAjnaKeeperAddress()
  if (!contracts.creatorVaultBatcher) throw new Error(deploymentBatcherNotConfiguredMessage())
  const creatorVaultBatcher = getAddress(contracts.creatorVaultBatcher)
  const vaultAuxiliaryDeployBatcher =
    contracts.vaultAuxiliaryDeployBatcher && isAddress(contracts.vaultAuxiliaryDeployBatcher)
      ? getAddress(contracts.vaultAuxiliaryDeployBatcher)
      : null
  const vaultActivationBatcher = getAddress(contracts.vaultActivationBatcher)
  const permit2 = getAddress(contracts.permit2)
  const configuredSwapRouter =
    contracts.swapRouter && isAddress(contracts.swapRouter) ? getAddress(contracts.swapRouter) : null
  const allowedUniversalSwapRouters = new Set<Address>([
    BASE_UNIVERSAL_ROUTER_CURRENT,
    ...(configuredSwapRouter ? [configuredSwapRouter] : []),
  ])
  const allowedSwapProxyRouters = new Set<Address>([UNISWAP_SWAP_PROXY_DEPLOY_ADDRESS])
  const allowedPayoutRouterV3Routers = new Set<Address>([
    BASE_V3_SWAP_ROUTER,
    ...(configuredSwapRouter ? [configuredSwapRouter] : []),
  ])
  const defaultSwapRouterForDerivedAddresses = configuredSwapRouter ?? BASE_V3_SWAP_ROUTER
  const create2DeployerFromStoreRaw = contracts.universalCreate2DeployerFromStore
  if (!create2DeployerFromStoreRaw) throw new Error('create2_deployer_from_store_not_configured')
  const create2DeployerFromStore = getAddress(create2DeployerFromStoreRaw)

  const decoded = decodeFunctionData({ abi: COINBASE_SMART_WALLET_ABI, data: params.callData })
  const innerCalls: InnerCall[] =
    decoded.functionName === 'execute'
      ? [
          {
            target: getAddress(decoded.args[0] as Address),
            value: decoded.args[1] as bigint,
            data: decoded.args[2] as Hex,
          },
        ]
      : decoded.functionName === 'executeBatch'
        ? (decoded.args[0] as any[]).map((c: any) => ({
            target: getAddress(c.target as Address),
            value: BigInt(c.value),
            data: c.data as Hex,
          }))
        : []

  if (innerCalls.length === 0) throw new Error('no_inner_calls')
  for (const c of innerCalls) {
    if (c.value === 0n) continue
    const selector = getSelector(c.data)
    const isWethDeposit = c.target === expectedWethToken && selector === SELECTOR_WETH_DEPOSIT
    if (isWethDeposit) {
      if (c.value <= 0n) throw new Error('weth_deposit_value_invalid')
      continue
    }
    const isFinalizeShareBridge =
      c.target === creatorVaultBatcher &&
      (selector === SELECTOR_BATCHER_FINALIZE_PHASE2 ||
        selector === SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2)
    if (isFinalizeShareBridge) continue
    throw new Error('value_transfer_not_allowed')
  }

  const erc8004Registry = getErc8004RegistryAddress()
  if (erc8004Registry) {
    const isAgentRegistryCall =
      innerCalls.length > 0 &&
      innerCalls.every((c) => c.target === erc8004Registry && ALLOWED_ERC8004_SELECTORS.has(getSelector(c.data)))
    if (isAgentRegistryCall) {
      return { expectedCreatorToken: null, mode: 'agent_registry' }
    }
  }

  // ERC-8004 Reputation Registry: allow giveFeedback / revokeFeedback / appendResponse
  const erc8004ReputationRegistry = getErc8004ReputationRegistryAddress()
  if (erc8004ReputationRegistry) {
    const isReputationCall =
      innerCalls.length > 0 &&
      innerCalls.every((c) => c.target === erc8004ReputationRegistry && ALLOWED_ERC8004_REPUTATION_SELECTORS.has(getSelector(c.data)))
    if (isReputationCall) {
      return { expectedCreatorToken: null, mode: 'reputation_feedback' }
    }
  }

  // Pass 1: detect the "primary" token from the deploy/activate call.
  let mode:
    | 'deploy_phase1'
    | 'deploy_phase2'
    | 'deploy_phase3'
    | 'launch_auction'
    | 'deploy'
    | 'activate'
    | 'swap'
    | 'legacy_withdraw'
    | 'deploy_session_setup'
    | 'agent_registry'
    | 'reputation_feedback'
    | null = null
  let expectedCreatorToken: Address | null = null
  let expectedVault: Address | null = null
  let expectedWrapper: Address | null = null
  let expectedShareOFT: Address | null = null
  let expectedVesting: Address | null = null
  let expectedCodeIds: { vault: Hex } | null = null
  let expectedVersion: string | null = null
  let expectedBurnStream: Address | null = null
  let expectedPayoutRouter: Address | null = null
  let expectedCreatorCoinPolicyController: Address | null = null

  for (const c of innerCalls) {
    const selector = getSelector(c.data)
    if (c.target === creatorVaultBatcher) {
      if (!ALLOWED_BATCHER_SELECTORS.has(selector)) throw new Error('batcher_selector_not_allowed')
      let creatorToken: Address | null = null
      let owner: Address | null = null

      // Phase-based functions encode params as a tuple (with strings/bytes), so decode via ABI.
      if (
        selector === SELECTOR_BATCHER_DEPLOY_PHASE1 ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE1_WITH_SALT ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE1_CORE ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE1_CORE_WITH_SALT ||
        selector === SELECTOR_BATCHER_FINALIZE_PHASE1 ||
        selector === SELECTOR_BATCHER_FINALIZE_PHASE1_WITH_SALT ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE2_CORE ||
        selector === SELECTOR_BATCHER_FINALIZE_PHASE2 ||
        selector === SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2 ||
        selector === SELECTOR_BATCHER_FINALIZE_PHASE2_LEGACY ||
        selector === SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES ||
        selector === SELECTOR_BATCHER_LAUNCH_DEFERRED_AUCTION
      ) {
        let decodedBatcher: any
        try {
          decodedBatcher = decodeFunctionData({ abi: CREATOR_VAULT_BATCHER_PHASE_ABI as any, data: c.data })
        } catch {
          throw new Error('batcher_decode_failed')
        }

        const p = decodedBatcher?.args?.[0]
        const codeIds = decodedBatcher?.args?.[1]
        creatorToken = p && isAddress(p.creatorToken) ? getAddress(p.creatorToken) : null
        owner = p && isAddress(p.owner) ? getAddress(p.owner) : null
        if (!creatorToken || !owner) throw new Error('batcher_decode_failed')
        if (owner !== params.sender) throw new Error('batcher_owner_mismatch')

        const isPhase2DeploySelector =
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_CORE
        const isPhase3DeploySelector = selector === SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES

        if (isPhase2DeploySelector) {
          if (!expectedProtocolTreasury) throw new Error('protocol_treasury_not_configured')
        }

        if (isPhase2DeploySelector) {
          const creatorTreasuryArg = p && isAddress(p.creatorTreasury) ? getAddress(p.creatorTreasury) : null
          const payoutRecipientArg = p && isAddress(p.payoutRecipient) ? getAddress(p.payoutRecipient) : null
          if (!creatorTreasuryArg || !payoutRecipientArg) throw new Error('batcher_phase2_policy_decode_failed')

          if (creatorTreasuryArg !== expectedProtocolTreasury && creatorTreasuryArg !== ZERO_ADDRESS) {
            throw new Error('batcher_creator_treasury_mismatch')
          }
          // creatorCoinPayoutRecipient (external earnings lane) policy is enforced explicitly through router wiring + policy controller handoff (see canonical lanes doc).
          // In greenfield deploys the batcher forces this to zero; the owner sets the actual creatorCoinPayoutRecipient (external earnings lane) post-deploy.
          if (payoutRecipientArg !== ZERO_ADDRESS) throw new Error('batcher_creator_coin_payout_recipient_must_be_zero')

          const expectedPhase2CodeIds = {
            vault: CREATOR_OVAULT_CODE_ID,
            wrapper: CREATOR_OVAULT_WRAPPER_CODE_ID,
            shareOFT: CREATOR_SHARE_OFT_CODE_ID,
            gauge: CREATOR_GAUGE_CONTROLLER_CODE_ID,
            cca: CCA_LAUNCH_STRATEGY_CODE_ID,
            oracle: CREATOR_ORACLE_CODE_ID,
            oftBootstrap: OFT_BOOTSTRAP_REGISTRY_CODE_ID,
          } as const
          const hasValidPhase2CodeIds =
            codeIds &&
            typeof codeIds === 'object' &&
            isHexString(codeIds.vault) &&
            isHexString(codeIds.wrapper) &&
            isHexString(codeIds.shareOFT) &&
            isHexString(codeIds.gauge) &&
            isHexString(codeIds.cca) &&
            isHexString(codeIds.oracle) &&
            isHexString(codeIds.oftBootstrap) &&
            String(codeIds.vault).toLowerCase() === String(expectedPhase2CodeIds.vault).toLowerCase() &&
            String(codeIds.wrapper).toLowerCase() === String(expectedPhase2CodeIds.wrapper).toLowerCase() &&
            String(codeIds.shareOFT).toLowerCase() === String(expectedPhase2CodeIds.shareOFT).toLowerCase() &&
            String(codeIds.gauge).toLowerCase() === String(expectedPhase2CodeIds.gauge).toLowerCase() &&
            String(codeIds.cca).toLowerCase() === String(expectedPhase2CodeIds.cca).toLowerCase() &&
            String(codeIds.oracle).toLowerCase() === String(expectedPhase2CodeIds.oracle).toLowerCase() &&
            String(codeIds.oftBootstrap).toLowerCase() === String(expectedPhase2CodeIds.oftBootstrap).toLowerCase()
          if (!hasValidPhase2CodeIds) throw new Error('batcher_phase2_codeids_mismatch')
        }

        if (isPhase3DeploySelector) {
          if (!expectedProtocolTreasury) throw new Error('protocol_treasury_not_configured')

          // Resolve the paid-feature plan FIRST so we know which weights
          // the caller is allowed to request. Unpaid-but-nonzero weights
          // are rejected here (last line of defence; the UI also gates
          // via /api/creator/strategy/list). Uses the same creator_token
          // the Phase3Params references.
          const phase3CreatorToken =
            p && isAddress(p.creatorToken) ? getAddress(p.creatorToken) : null
          if (!phase3CreatorToken) throw new Error('batcher_phase3_creator_token_decode_failed')

          const charmWeightBpsBig = (() => {
            try {
              return BigInt((p.charmWeightBps ?? 0n) as bigint | string | number)
            } catch {
              return null
            }
          })()
          const ajnaWeightBpsBig = (() => {
            try {
              return BigInt((p.ajnaWeightBps ?? 0n) as bigint | string | number)
            } catch {
              return null
            }
          })()
          const solanaWeightBpsBig = (() => {
            try {
              return BigInt((p.solanaWeightBps ?? 0n) as bigint | string | number)
            } catch {
              return null
            }
          })()
          if (charmWeightBpsBig === null || ajnaWeightBpsBig === null || solanaWeightBpsBig === null) {
            throw new Error('batcher_phase3_weight_decode_failed')
          }

          if (!isDbConfigured()) {
            // Security posture: refuse to sponsor paid-feature-gated Phase 3
            // deploys when we can't consult the activations DB. Better to
            // fail-closed and send the creator through the USDC-on-Base
            // legacy path than sponsor a UserOp we can't verify.
            throw new Error('paywall_db_not_configured')
          }
          const paywallDb = await getDb()
          if (!paywallDb) throw new Error('paywall_db_unavailable')
          const paywallPlan = await resolveCreatorStrategyPlan(
            paywallDb as any,
            phase3CreatorToken,
          )
          if (!paywallPlan.ok) {
            throw new Error(`paywall_plan_not_found:${paywallPlan.reason}`)
          }
          const paywallGate = gateRequestedStrategyWeights(paywallPlan.plan, {
            charmWeightBps: charmWeightBpsBig,
            ajnaWeightBps: ajnaWeightBpsBig,
            solanaWeightBps: solanaWeightBpsBig,
          })
          if (!paywallGate.ok) {
            throw new Error(`paywall_weight_gate:${paywallGate.reason}`)
          }

          const ajnaKeeperArg = p && isAddress(p.ajnaKeeper) ? getAddress(p.ajnaKeeper) : null
          const solanaKeeperArg = p && isAddress(p.solanaKeeper) ? getAddress(p.solanaKeeper) : null
          // Keeper args are only required when the corresponding strategy
          // is actually being deployed (weight > 0). Unpaid strategies pass
          // weight=0 and can skip the keeper arg.
          if (ajnaWeightBpsBig !== 0n && !ajnaKeeperArg) {
            throw new Error('batcher_phase3_keeper_decode_failed')
          }
          if (solanaWeightBpsBig !== 0n && !solanaKeeperArg) {
            throw new Error('batcher_phase3_keeper_decode_failed')
          }
          if (ajnaWeightBpsBig !== 0n) {
            if (!expectedProtocolAjnaKeeper) {
              throw new Error('protocol_ajna_keeper_not_configured')
            }
            if (ajnaKeeperArg && ajnaKeeperArg !== expectedProtocolAjnaKeeper) {
              throw new Error('batcher_ajna_keeper_mismatch')
            }
          }
          if (solanaKeeperArg && solanaKeeperArg !== expectedProtocolTreasury) {
            throw new Error('batcher_solana_keeper_mismatch')
          }

          const expectedPhase3CodeIds = {
            charmAlphaVaultDeploy: CHARM_ALPHA_VAULT_DEPLOY_SENTINEL_CODE_ID,
            creatorCharmStrategy: CREATOR_CHARM_STRATEGY_CODE_ID,
            ajnaVaultAuth: AJNA_VAULT_AUTH_CODE_ID,
            ajnaVault: AJNA_ERC4626_VAULT_CODE_ID,
            erc4626StrategyAdapter: ERC4626_STRATEGY_ADAPTER_CODE_ID,
            solanaStrategy: SOLANA_STRATEGY_CODE_ID,
          } as const
          // Skipped strategies can pass `bytes32(0)` for their codeId per
          // the contract patch. Only require + validate the codeIds whose
          // strategy will actually be deployed (weight > 0).
          const ZERO_CODE_ID = '0x0000000000000000000000000000000000000000000000000000000000000000'
          const codeIdMatches = (actual: unknown, expected: string, required: boolean): boolean => {
            if (!isHexString(actual)) return false
            const actualLower = String(actual).toLowerCase()
            if (!required && actualLower === ZERO_CODE_ID) return true
            return actualLower === String(expected).toLowerCase()
          }
          const hasValidPhase3CodeIds =
            codeIds &&
            typeof codeIds === 'object' &&
            codeIdMatches(
              codeIds.charmAlphaVaultDeploy,
              expectedPhase3CodeIds.charmAlphaVaultDeploy,
              charmWeightBpsBig !== 0n,
            ) &&
            codeIdMatches(
              codeIds.creatorCharmStrategy,
              expectedPhase3CodeIds.creatorCharmStrategy,
              charmWeightBpsBig !== 0n,
            ) &&
            codeIdMatches(
              codeIds.ajnaVaultAuth,
              expectedPhase3CodeIds.ajnaVaultAuth,
              ajnaWeightBpsBig !== 0n,
            ) &&
            codeIdMatches(
              codeIds.ajnaVault,
              expectedPhase3CodeIds.ajnaVault,
              ajnaWeightBpsBig !== 0n,
            ) &&
            codeIdMatches(
              codeIds.erc4626StrategyAdapter,
              expectedPhase3CodeIds.erc4626StrategyAdapter,
              ajnaWeightBpsBig !== 0n,
            ) &&
            codeIdMatches(
              codeIds.solanaStrategy,
              expectedPhase3CodeIds.solanaStrategy,
              solanaWeightBpsBig !== 0n,
            )
          if (!hasValidPhase3CodeIds) throw new Error('batcher_phase3_codeids_mismatch')
        }

        if (
          selector === SELECTOR_BATCHER_DEPLOY_PHASE1 ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE1_WITH_SALT ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE1_CORE ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE1_CORE_WITH_SALT ||
          selector === SELECTOR_BATCHER_FINALIZE_PHASE1 ||
          selector === SELECTOR_BATCHER_FINALIZE_PHASE1_WITH_SALT
        ) {
          mode = 'deploy_phase1'
        } else if (
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_AND_LAUNCH_WITH_PERMIT ||
          selector === SELECTOR_BATCHER_DEPLOY_PHASE2_CORE ||
          selector === SELECTOR_BATCHER_FINALIZE_PHASE2 ||
          selector === SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2 ||
          selector === SELECTOR_BATCHER_FINALIZE_PHASE2_LEGACY
        ) {
          mode = 'deploy_phase2'
          expectedVault = p && isAddress(p.vault) ? getAddress(p.vault) : null
          expectedWrapper = p && isAddress(p.wrapper) ? getAddress(p.wrapper) : null
          expectedShareOFT = p && isAddress(p.shareOFT) ? getAddress(p.shareOFT) : null
          if (!expectedVault) throw new Error('batcher_vault_decode_failed')
          expectedCodeIds =
            codeIds && typeof codeIds === 'object' && isHexString(codeIds.vault)
              ? { vault: codeIds.vault as Hex }
              : null
          expectedVersion = typeof p?.version === 'string' ? p.version : null
        } else if (selector === SELECTOR_BATCHER_DEPLOY_PHASE3_STRATEGIES) {
          mode = 'deploy_phase3'
          expectedVault = p && isAddress(p.vault) ? getAddress(p.vault) : null
          if (!expectedVault) throw new Error('batcher_vault_decode_failed')
        } else if (selector === SELECTOR_BATCHER_LAUNCH_DEFERRED_AUCTION) {
          mode = 'launch_auction'
        }
      } else {
        // Legacy one-call deploy functions have owner/creatorToken as the first two static args.
        creatorToken = decodeAddressArgFromCalldata(c.data, 0)
        owner = decodeAddressArgFromCalldata(c.data, 1)
        if (!creatorToken || !owner) throw new Error('batcher_decode_failed')
        if (owner !== params.sender) throw new Error('batcher_owner_mismatch')
        mode = 'deploy'
      }

      expectedCreatorToken = creatorToken
      break
    }
    if (c.target === vaultActivationBatcher) {
      if (!ALLOWED_ACTIVATION_SELECTORS.has(selector)) throw new Error('activation_selector_not_allowed')
      const creatorToken =
        selector === SELECTOR_ACTIVATION_BATCH_ACTIVATE
          ? decodeAddressArgFromCalldata(c.data, 0)
          : decodeAddressArgFromCalldata(c.data, 1) // batchActivateWithPermit2For(identity, creatorToken, ...)
      if (!creatorToken) throw new Error('activation_decode_failed')
      mode = 'activate'
      expectedCreatorToken = creatorToken
      break
    }
  }

  if (!mode || !expectedCreatorToken) {
    const isSelfcallOnly =
      innerCalls.length > 0 &&
      innerCalls.every((c) => c.target === params.sender && ALLOWED_SELF_SELECTORS.has(getSelector(c.data)))

    if (isSelfcallOnly) {
      mode = 'deploy_session_setup'
      expectedCreatorToken = null
    } else {
      const swapMode = (() => {
        let sawSwapRouter = false
        let swapRouterCalls = 0
        let approvalCalls = 0
        let wethDepositCalls = 0
        let approvedToken: Address | null = null
        let wrappedToken: Address | null = null
        let swapRouterCallData: Hex | null = null
        let swapRouterTarget: Address | null = null
        let swapRouterKind: 'universal' | 'swap-proxy' | 'v3' | 'zora-universal' | null = null
        let approvalSpender: Address | null = null
        for (const c of innerCalls) {
          const selector = getSelector(c.data)
          if (c.target === expectedWethToken && selector === SELECTOR_WETH_DEPOSIT) {
            if (c.value <= 0n) throw new Error('weth_deposit_value_invalid')
            wethDepositCalls += 1
            if (wethDepositCalls > 1) throw new Error('weth_deposit_call_count_not_allowed')
            wrappedToken = expectedWethToken
            continue
          }

          const isUniversalRouterCall = allowedUniversalSwapRouters.has(c.target) && selector === SELECTOR_SWAP_ROUTER_EXECUTE
          const isZoraUniversalRouterCall =
            allowedUniversalSwapRouters.has(c.target) && selector === SELECTOR_ZORA_SWAP_ROUTER_EXECUTE
          const isSwapProxyCall = allowedSwapProxyRouters.has(c.target) && selector === SELECTOR_SWAP_PROXY_EXECUTE
          const isV3RouterCall = allowedPayoutRouterV3Routers.has(c.target) && ALLOWED_V3_SWAP_ROUTER_SELECTORS.has(selector)
          if (isUniversalRouterCall || isZoraUniversalRouterCall || isSwapProxyCall || isV3RouterCall) {
            if (c.value !== 0n) throw new Error('swap_router_value_not_allowed')
            if (isUniversalRouterCall) assertCanonicalSwapRouterExecuteEncoding(c.data)
            sawSwapRouter = true
            swapRouterCalls += 1
            if (swapRouterCalls > 1) throw new Error('swap_router_call_count_not_allowed')
            swapRouterCallData = c.data
            swapRouterTarget = c.target
            swapRouterKind = isUniversalRouterCall
              ? 'universal'
              : isZoraUniversalRouterCall
                ? 'zora-universal'
                : isSwapProxyCall
                  ? 'swap-proxy'
                  : 'v3'
            continue
          }

          if (selector !== SELECTOR_ERC20_APPROVE) return { matched: false, creatorToken: null as Address | null }
          if (c.value !== 0n) throw new Error('value_transfer_not_allowed')
          approvalCalls += 1
          if (approvalCalls > 1) throw new Error('swap_approval_call_count_not_allowed')
          const spender = decodeAddressArgFromCalldata(c.data, 0)
          if (!spender) return { matched: false, creatorToken: null as Address | null }
          approvalSpender = spender
          const amount = decodeUint256ArgFromCalldata(c.data, 1)
          if (amount == null || amount <= 0n) throw new Error('swap_approval_amount_invalid')
          const approvalToken = getAddress(c.target)
          if (!approvedToken) {
            approvedToken = approvalToken
          } else if (approvedToken !== approvalToken) {
            throw new Error('swap_approval_token_mismatch')
          }
        }

        const spenderAllowedForSwap = Boolean(
          approvalSpender &&
            (approvalSpender === permit2 ||
              (swapRouterTarget
                ? approvalSpender === swapRouterTarget
                : allowedUniversalSwapRouters.has(approvalSpender) || allowedPayoutRouterV3Routers.has(approvalSpender))),
        )
        if (approvalCalls > 0 && !spenderAllowedForSwap) {
          return { matched: false, creatorToken: null as Address | null }
        }

        const configuredUsdc =
          contracts.usdc && isAddress(contracts.usdc) ? getAddress(contracts.usdc) : BASE_USDC
        let swapInputToken = approvedToken ?? wrappedToken
        if (
          !swapInputToken &&
          swapRouterKind === 'zora-universal' &&
          swapRouterCallData &&
          approvalCalls === 0
        ) {
          // Zora trades embed Permit2 in router calldata (no separate approve inner call).
          const candidates = [configuredUsdc, expectedZoraToken, expectedWethToken, permit2].filter(
            (token): token is Address => Boolean(token),
          )
          swapInputToken = resolveSwapInputTokenFromRouterCalldata(swapRouterCallData, candidates)
          // Permit2 payloads may not repeat the sell token as a bare 20-byte needle; still
          // sponsor the known Zora single-call lane with USDC policy when shape matches.
          if (!swapInputToken && swapRouterCalls === 1) {
            swapInputToken = configuredUsdc
          }
        }

        if (sawSwapRouter && swapInputToken && swapRouterCallData) {
          if (swapRouterKind === 'universal') {
            assertSwapRouterPayloadReferencesToken(swapRouterCallData, swapInputToken)
          } else {
            // Zora quotes use execute(bytes,bytes[]) without deadline; validate via raw calldata.
            assertRawSwapPayloadReferencesToken(swapRouterCallData, swapInputToken)
          }
        }

        const zoraPermitEmbeddedSwap =
          swapRouterKind === 'zora-universal' && approvalCalls === 0 && swapRouterCalls === 1

        return {
          matched:
            sawSwapRouter &&
            swapRouterCalls === 1 &&
            !!swapInputToken &&
            (approvalCalls <= 1 || zoraPermitEmbeddedSwap),
          creatorToken: swapInputToken,
        }
      })()

      if (swapMode.matched) {
        mode = 'swap'
        expectedCreatorToken = swapMode.creatorToken
      }

      const approveOnlyToken = (() => {
        if (innerCalls.length === 0) return null
        const firstTarget = innerCalls[0].target
        const allowedSpenders = new Set<Address>([creatorVaultBatcher, vaultActivationBatcher, permit2])
        const ok = innerCalls.every((c) => {
          if (c.target !== firstTarget) return false
          if (getSelector(c.data) !== SELECTOR_ERC20_APPROVE) return false
          const spender = decodeAddressArgFromCalldata(c.data, 0)
          return !!spender && allowedSpenders.has(spender)
        })
        return ok ? getAddress(firstTarget) : null
      })()

      if (mode === 'swap') {
        // Swap-only sponsorship path validated above (strict target/selector/value checks).
      } else if (approveOnlyToken) {
        throw new Error('approve_only_not_allowed')
      } else {
        const legacyResolved = await (async () => {
          const client = await getBaseClient()
          let legacyVault: Address | null = null
          let legacyWrapper: Address | null = null
          let legacyShareOFT: Address | null = null
          let legacyVesting: Address | null = null

          const setVault = (next: Address) => {
            if (!legacyVault) {
              legacyVault = next
              return
            }
            if (getAddress(legacyVault) !== getAddress(next)) throw new Error('legacy_vault_mismatch')
          }

          const setShareOft = (next: Address) => {
            if (!legacyShareOFT) {
              legacyShareOFT = next
              return
            }
            if (getAddress(legacyShareOFT) !== getAddress(next)) throw new Error('legacy_shareoft_mismatch')
          }

          for (const c of innerCalls) {
            const selector = getSelector(c.data)
            if (selector === SELECTOR_VESTING_RELEASE) {
              legacyVesting = c.target
              const [token, beneficiary] = (await Promise.all([
                client.readContract({ address: c.target, abi: LEGACY_VESTING_VIEW_ABI, functionName: 'token' }).catch(() => null),
                client.readContract({ address: c.target, abi: LEGACY_VESTING_VIEW_ABI, functionName: 'beneficiary' }).catch(() => null),
              ])) as [Address | null, Address | null]
              if (beneficiary && isAddress(beneficiary)) {
                if (getAddress(beneficiary) !== getAddress(params.sender)) {
                  throw new Error('legacy_vesting_beneficiary_mismatch')
                }
              }
              if (token && isAddress(token)) {
                const share = getAddress(token)
                setShareOft(share)
                const vaultFromShare = (await client.readContract({
                  address: share,
                  abi: SHARE_OFT_VIEW_ABI,
                  functionName: 'vault',
                }).catch(() => null)) as Address | null
                if (vaultFromShare && isAddress(vaultFromShare)) {
                  setVault(getAddress(vaultFromShare))
                }
              }
              continue
            }
            if (selector === SELECTOR_WRAPPER_UNWRAP) {
              legacyWrapper = c.target
              const [wrapperVault, wrapperShare] = (await Promise.all([
                client.readContract({ address: c.target, abi: WRAPPER_VIEW_ABI, functionName: 'vault' }).catch(() => null),
                client.readContract({ address: c.target, abi: WRAPPER_VIEW_ABI, functionName: 'shareOFT' }).catch(() => null),
              ])) as [Address | null, Address | null]
              if (wrapperVault && isAddress(wrapperVault)) setVault(getAddress(wrapperVault))
              if (wrapperShare && isAddress(wrapperShare)) setShareOft(getAddress(wrapperShare))
              continue
            }
            if (ALL_LEGACY_VAULT_SELECTORS.has(selector)) {
              setVault(c.target)
              continue
            }
            return null
          }

          if (!legacyVault) return null
          const legacyVaultAddress = getAddress(legacyVault)
          const [vaultCode, wrapperCode, shareCode, vestingCode] = (await Promise.all([
            client.getBytecode({ address: legacyVaultAddress }),
            legacyWrapper ? client.getBytecode({ address: legacyWrapper }) : Promise.resolve(undefined),
            legacyShareOFT ? client.getBytecode({ address: legacyShareOFT }) : Promise.resolve(undefined),
            legacyVesting ? client.getBytecode({ address: legacyVesting }) : Promise.resolve(undefined),
          ])) as [Hex | undefined, Hex | undefined, Hex | undefined, Hex | undefined]
          if (!vaultCode || vaultCode === '0x') throw new Error('legacy_vault_not_deployed')
          if (legacyWrapper && (!wrapperCode || wrapperCode === '0x')) {
            throw new Error('legacy_wrapper_not_deployed')
          }
          if (legacyShareOFT && (!shareCode || shareCode === '0x')) {
            throw new Error('legacy_shareoft_not_deployed')
          }
          if (legacyVesting && (!vestingCode || vestingCode === '0x')) {
            throw new Error('legacy_vesting_not_deployed')
          }
          const asset = (await client.readContract({
            address: legacyVaultAddress,
            abi: ERC4626_ASSET_ABI,
            functionName: 'asset',
          }).catch(() => null)) as Address | null
          if (!asset || !isAddress(asset)) throw new Error('legacy_vault_asset_not_found')
          const creatorToken = getAddress(asset)
          if (legacyWrapper || legacyShareOFT) {
            const [
              wrapperVault,
              wrapperShare,
              wrapperCreatorCoin,
              wrapperOwner,
              shareVault,
              shareOwner,
            ] = (await Promise.all([
              legacyWrapper
                ? client
                    .readContract({
                      address: legacyWrapper,
                      abi: WRAPPER_VIEW_ABI,
                      functionName: 'vault',
                    })
                    .catch(() => null)
                : Promise.resolve(null),
              legacyWrapper
                ? client
                    .readContract({
                      address: legacyWrapper,
                      abi: WRAPPER_VIEW_ABI,
                      functionName: 'shareOFT',
                    })
                    .catch(() => null)
                : Promise.resolve(null),
              legacyWrapper
                ? client
                    .readContract({
                      address: legacyWrapper,
                      abi: WRAPPER_VIEW_ABI,
                      functionName: 'creatorCoin',
                    })
                    .catch(() => null)
                : Promise.resolve(null),
              legacyWrapper
                ? client
                    .readContract({
                      address: legacyWrapper,
                      abi: WRAPPER_VIEW_ABI,
                      functionName: 'owner',
                    })
                    .catch(() => null)
                : Promise.resolve(null),
              legacyShareOFT
                ? client
                    .readContract({
                      address: legacyShareOFT,
                      abi: SHARE_OFT_VIEW_ABI,
                      functionName: 'vault',
                    })
                    .catch(() => null)
                : Promise.resolve(null),
              legacyShareOFT
                ? client
                    .readContract({
                      address: legacyShareOFT,
                      abi: SHARE_OFT_VIEW_ABI,
                      functionName: 'owner',
                    })
                    .catch(() => null)
                : Promise.resolve(null),
            ])) as [
              Address | null,
              Address | null,
              Address | null,
              Address | null,
              Address | null,
              Address | null,
            ]

            if (legacyWrapper) {
              if (!wrapperVault || getAddress(wrapperVault) !== legacyVaultAddress) {
                throw new Error('legacy_wrapper_vault_mismatch')
              }
              if (!wrapperCreatorCoin || getAddress(wrapperCreatorCoin) !== creatorToken) {
                throw new Error('legacy_wrapper_creator_token_mismatch')
              }
              if (wrapperOwner && getAddress(wrapperOwner) !== creatorVaultBatcher) {
                throw new Error('legacy_wrapper_owner_mismatch')
              }
              if (!wrapperShare || !isAddress(wrapperShare)) {
                throw new Error('legacy_wrapper_shareoft_missing')
              }
              const wrapperShareAddress = getAddress(wrapperShare)
              if (legacyShareOFT && wrapperShareAddress !== getAddress(legacyShareOFT)) {
                throw new Error('legacy_wrapper_shareoft_mismatch')
              }
              if (!legacyShareOFT) {
                legacyShareOFT = wrapperShareAddress
              }
            }

            if (legacyShareOFT) {
              if (!shareVault || getAddress(shareVault) !== legacyVaultAddress) {
                throw new Error('legacy_shareoft_vault_mismatch')
              }
              if (shareOwner && getAddress(shareOwner) !== creatorVaultBatcher) {
                throw new Error('legacy_shareoft_owner_mismatch')
              }
            }
          }
          const phase1Logs = await client
            .getLogs({
              address: creatorVaultBatcher,
              event: CREATOR_VAULT_BATCHER_PHASE1_EVENT[0],
              args: { creatorToken, owner: params.sender },
              fromBlock: 0n,
              toBlock: 'latest',
            })
            .catch(() => [])
          const matchedPhase1 = phase1Logs.some((log: any) =>
            matchesPhase1DeployedLog(log, {
              vault: getAddress(legacyVault as Address),
              wrapper: legacyWrapper,
              shareOFT: legacyShareOFT,
            }),
          )
          if (!matchedPhase1) throw new Error('legacy_vault_provenance_mismatch')
          return {
            creatorToken,
            vault: legacyVault,
            wrapper: legacyWrapper,
            shareOFT: legacyShareOFT,
            vesting: legacyVesting,
          }
        })()

        if (legacyResolved?.creatorToken && legacyResolved?.vault) {
          mode = 'legacy_withdraw'
          expectedCreatorToken = legacyResolved.creatorToken
          expectedVault = legacyResolved.vault
          expectedWrapper = legacyResolved.wrapper ?? null
          expectedShareOFT = legacyResolved.shareOFT ?? null
          expectedVesting = legacyResolved.vesting ?? null
        } else {
          const sample = innerCalls
            .slice(0, 3)
            .map((c) => `${c.target}:${getSelector(c.data)}`)
            .join(',')
          throw new Error(
            `missing_primary_call(expectedBatcher=${creatorVaultBatcher},expectedActivation=${vaultActivationBatcher},seen=${sample})`,
          )
        }
      }
    }
  }

  if (mode === 'swap') {
    return { expectedCreatorToken, mode: 'swap' }
  }

  // Prefer deriving the bytecode store from the deployer itself (`deployer.store()`),
  // so paymaster validation cannot drift from onchain infra due to env misconfiguration.
  const bytecodeStoreRaw = contracts.universalBytecodeStore
  const envStore: Address | null = bytecodeStoreRaw && isAddress(bytecodeStoreRaw) ? getAddress(bytecodeStoreRaw) : null
  let bytecodeStore: Address | null = envStore
  let deployerStore: Address | null = null
  if (bytecodeStoreRaw && isAddress(bytecodeStoreRaw)) {
    bytecodeStore = getAddress(bytecodeStoreRaw)
  }
  try {
    const CREATE2_DEPLOYER_STORE_ABI = [
      {
        type: 'function',
        name: 'store',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'address' }],
      },
    ] as const
    const client = await getBaseClient()
    const store = (await client.readContract({
      address: create2DeployerFromStore,
      abi: CREATE2_DEPLOYER_STORE_ABI,
      functionName: 'store',
    })) as Address
    if (store && isAddress(store)) {
      deployerStore = getAddress(store)
      bytecodeStore = deployerStore
    }
  } catch {
    // ignore; fall back to env/default
  }
  if (!bytecodeStore) throw new Error('bytecode_store_not_configured')
  params.debug?.({
    deployer: create2DeployerFromStore,
    storeEnv: envStore,
    storeFromDeployer: deployerStore,
    storeUsed: bytecodeStore,
    expectedVault,
  })
  if (envStore && envStore !== bytecodeStore) {
    logger.warn('[Paymaster] bytecode_store_mismatch', {
      envBytecodeStore: envStore,
      deployerStore: bytecodeStore,
      deployer: create2DeployerFromStore,
    })
  }

  // In Phase 2/3, validate the vault address via CREATE2 inputs (salt + codeId + constructor args).
  // If codeIds are missing, fall back to the Phase1Deployed event for this creator/owner.
  if (mode === 'deploy_phase2' || mode === 'deploy_phase3') {
    if (!expectedVault) throw new Error('missing_vault')
    const client = await getBaseClient()
    const vaultCode = (await client.getBytecode({ address: expectedVault })) as Hex | undefined
    if (!vaultCode || vaultCode === '0x') throw new Error('vault_not_deployed')
    const asset = (await client.readContract({
      address: expectedVault,
      abi: ERC4626_ASSET_ABI,
      functionName: 'asset',
    }).catch(() => null)) as Address | null
    if (asset && getAddress(asset) !== getAddress(expectedCreatorToken as Address)) {
      throw new Error('vault_asset_mismatch')
    }
    if (mode === 'deploy_phase2') {
      if (!expectedWrapper || !expectedShareOFT) throw new Error('missing_wrapper_or_shareoft')
      const [wrapperCode, shareCode] = (await Promise.all([
        client.getBytecode({ address: expectedWrapper }),
        client.getBytecode({ address: expectedShareOFT }),
      ])) as [Hex | undefined, Hex | undefined]
      if (!wrapperCode || wrapperCode === '0x') throw new Error('wrapper_not_deployed')
      if (!shareCode || shareCode === '0x') throw new Error('shareoft_not_deployed')
      const [wrapperVault, wrapperShare, wrapperCreatorCoin, wrapperOwner, shareVault, shareOwner] = (await Promise.all([
        client.readContract({ address: expectedWrapper, abi: WRAPPER_VIEW_ABI, functionName: 'vault' }).catch(() => null),
        client.readContract({ address: expectedWrapper, abi: WRAPPER_VIEW_ABI, functionName: 'shareOFT' }).catch(() => null),
        client.readContract({ address: expectedWrapper, abi: WRAPPER_VIEW_ABI, functionName: 'creatorCoin' }).catch(() => null),
        client.readContract({ address: expectedWrapper, abi: WRAPPER_VIEW_ABI, functionName: 'owner' }).catch(() => null),
        client.readContract({ address: expectedShareOFT, abi: SHARE_OFT_VIEW_ABI, functionName: 'vault' }).catch(() => null),
        client.readContract({ address: expectedShareOFT, abi: SHARE_OFT_VIEW_ABI, functionName: 'owner' }).catch(() => null),
      ])) as [Address | null, Address | null, Address | null, Address | null, Address | null, Address | null]
      if (!wrapperVault || getAddress(wrapperVault) !== expectedVault) throw new Error('wrapper_vault_mismatch')
      if (!wrapperShare || getAddress(wrapperShare) !== expectedShareOFT) throw new Error('wrapper_shareoft_mismatch')
      if (!wrapperCreatorCoin || getAddress(wrapperCreatorCoin) !== getAddress(expectedCreatorToken as Address)) {
        throw new Error('wrapper_creator_token_mismatch')
      }
      if (!shareVault || getAddress(shareVault) !== expectedVault) throw new Error('shareoft_vault_mismatch')
      if (wrapperOwner && getAddress(wrapperOwner) !== creatorVaultBatcher) throw new Error('wrapper_owner_mismatch')
      if (shareOwner && getAddress(shareOwner) !== creatorVaultBatcher) throw new Error('shareoft_owner_mismatch')
      for (const c of innerCalls) {
        if (c.target !== creatorVaultBatcher) continue
        const selector = getSelector(c.data)
        if (
          selector !== SELECTOR_BATCHER_FINALIZE_PHASE2 &&
          selector !== SELECTOR_BATCHER_FINALIZE_PHASE2_WITH_PERMIT2
        ) {
          continue
        }
        await assertFinalizeShareBridgeCallValue({
          publicClient: client,
          batcherAddress: creatorVaultBatcher,
          callData: c.data,
          value: c.value,
        })
      }
    }
    const [vaultName, vaultSymbol] = (await Promise.all([
      client.readContract({ address: expectedVault, abi: ERC20_METADATA_ABI, functionName: 'name' }),
      client.readContract({ address: expectedVault, abi: ERC20_METADATA_ABI, functionName: 'symbol' }),
    ])) as [string, string]
    let vaultValidated = false
    const canValidateViaCreate2 =
      !!expectedCodeIds?.vault && expectedCodeIds.vault !== ZERO_BYTES32 && typeof expectedVersion === 'string'
    if (canValidateViaCreate2) {
      const vaultCodeId = expectedCodeIds?.vault
      const version = expectedVersion as string
      if (!vaultCodeId) throw new Error('missing_code_ids')
      if (String(vaultCodeId).toLowerCase() !== String(CREATOR_OVAULT_CODE_ID).toLowerCase()) {
        throw new Error('vault_codeid_not_allowed')
      }
      const creationCode = DEPLOY_BYTECODE.CreatorOVault as Hex
      const constructorArgs = encodeAbiParameters(
        [
          { type: 'address', name: 'creatorToken' },
          { type: 'address', name: 'owner' },
          { type: 'string', name: 'name' },
          { type: 'string', name: 'symbol' },
        ],
        [getAddress(expectedCreatorToken as Address), getAddress(creatorVaultBatcher), vaultName, vaultSymbol],
      )
      const initCodeHash = keccak256(concatHex([creationCode, constructorArgs]))
      const baseSalt = keccak256(
        encodePacked(
          ['address', 'address', 'uint256', 'string', 'string'],
          [getAddress(expectedCreatorToken as Address), params.sender, BigInt(BASE_CHAIN_ID), '4626:deploy:', version],
        ),
      )
      const vaultSalt = keccak256(encodePacked(['bytes32', 'string'], [baseSalt, 'vault']))
      const expectedVaultFromCreate2 = getCreate2Address({
        from: create2DeployerFromStore,
        salt: vaultSalt,
        bytecodeHash: initCodeHash,
      })
      vaultValidated = expectedVaultFromCreate2.toLowerCase() === expectedVault.toLowerCase()
      if (!vaultValidated) {
        logger.warn('[Paymaster] vault_address_mismatch', {
          expected: expectedVaultFromCreate2,
          actual: expectedVault,
          creatorToken: expectedCreatorToken,
          sender: params.sender,
        })
      }
    }

    if (!vaultValidated) {
      const phase1Logs = await client
        .getLogs({
          address: creatorVaultBatcher,
          event: CREATOR_VAULT_BATCHER_PHASE1_EVENT[0],
          args: { creatorToken: expectedCreatorToken as Address, owner: params.sender },
          fromBlock: 0n,
          toBlock: 'latest',
        })
        .catch(() => [])
      const matchedPhase1 = phase1Logs.some((log: any) => {
        return matchesPhase1DeployedLog(log, {
          vault: expectedVault as Address,
          wrapper: expectedWrapper,
          shareOFT: expectedShareOFT,
        })
      })
      if (!matchedPhase1) {
        throw new Error('vault_address_mismatch(phase1_event_miss)')
      }
    }

    const burnSalt = deriveVaultShareBurnStreamSalt({ creatorToken: expectedCreatorToken as Address, owner: params.sender })
    expectedBurnStream = await computeCreate2AddressFromStore({
      store: bytecodeStore,
      deployer: create2DeployerFromStore,
      salt: burnSalt,
      codeId: VAULT_SHARE_BURN_STREAM_CODE_ID as Hex,
      constructorArgs: abiEncodeAddresses([expectedVault]),
    })

    const routerSalt = derivePayoutRouterSalt({ creatorToken: expectedCreatorToken as Address, owner: params.sender })
    if (!expectedProtocolTreasury) throw new Error('protocol_treasury_not_configured')
    expectedPayoutRouter = await computeCreate2AddressFromStore({
      store: bytecodeStore,
      deployer: create2DeployerFromStore,
      salt: routerSalt,
      codeId: PAYOUT_ROUTER_CODE_ID as Hex,
      constructorArgs: abiEncodeAddresses([
        expectedCreatorToken as Address,
        expectedVault,
        expectedBurnStream,
        expectedProtocolTreasury,
        defaultSwapRouterForDerivedAddresses,
        BASE_WETH,
        ZERO_ADDRESS,
      ]),
    })
    const policyControllerSalt = deriveCreatorCoinPolicyControllerSalt({
      creatorToken: expectedCreatorToken as Address,
      owner: params.sender,
    })
    expectedCreatorCoinPolicyController = await computeCreate2AddressFromStore({
      store: bytecodeStore,
      deployer: create2DeployerFromStore,
      salt: policyControllerSalt,
      codeId: CREATOR_COIN_POLICY_CONTROLLER_CODE_ID as Hex,
      constructorArgs: abiEncodeAddresses([
        expectedCreatorToken as Address,
        expectedPayoutRouter,
        expectedProtocolTreasury as Address,
      ]),
    })

    params.debug?.({
      deployer: create2DeployerFromStore,
      storeEnv: envStore,
      storeFromDeployer: deployerStore,
      storeUsed: bytecodeStore,
      expectedVault,
      expectedBurnStream,
      expectedPayoutRouter,
      expectedCreatorCoinPolicyController,
    })
  }

  // Pass 2: validate each inner call fits the expected patterns.
  for (const c of innerCalls) {
    const selector = getSelector(c.data)

    // Self-calls (Coinbase Smart Wallet owner mgmt) for deploy-session automation.
    if (c.target === params.sender && ALLOWED_SELF_SELECTORS.has(selector)) {
      const decodedSelf = decodeFunctionData({ abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI, data: c.data })
      const allowInactiveForCleanup = decodedSelf.functionName === 'removeOwnerAtIndex'

      // Find the deploy session so we can bind the session owner address.
      const ds =
        params.deploySessionOwner && isAddress(params.deploySessionOwner)
          ? ({ sessionSigner: params.deploySessionOwner } as const)
          : await getActiveDeploySessionForSender({
              sessionAddress: params.sessionAddress,
              smartWallet: params.sender,
              includeExpired: allowInactiveForCleanup,
              includeFailed: allowInactiveForCleanup,
            })
      const deploySessionSigner = ds?.sessionSigner && isAddress(ds.sessionSigner) ? getAddress(ds.sessionSigner as Address) : null
      const canonicalEmbeddedOwner =
        params.canonicalEmbeddedOwner && isAddress(params.canonicalEmbeddedOwner)
          ? getAddress(params.canonicalEmbeddedOwner)
          : null

      if (decodedSelf.functionName === 'addOwnerAddress') {
        const ownerArg = getAddress(decodedSelf.args[0] as Address)
        if (params.customOwnerSponsorship) {
          if (params.customOwnerSponsorship.sessionAddress !== params.sessionAddress) {
            throw new Error('custom_owner_policy_session_mismatch')
          }
          if (params.customOwnerSponsorship.smartWalletAddress !== params.sender) {
            throw new Error('custom_owner_policy_sender_mismatch')
          }
          if (ownerArg !== params.customOwnerSponsorship.ownerToAdd) {
            throw new Error('custom_owner_policy_owner_mismatch')
          }
        } else if (deploySessionSigner) {
          if (ownerArg !== deploySessionSigner) throw new Error('deploy_session_owner_mismatch')
        } else if (canonicalEmbeddedOwner) {
          if (ownerArg !== canonicalEmbeddedOwner) throw new Error('canonical_embedded_owner_mismatch')
        } else {
          throw new Error('deploy_session_missing')
        }
        const client = await getBaseClient()
        const ownerCode = await client.getBytecode({ address: ownerArg })
        if (ownerCode && ownerCode !== '0x') throw new Error('contract_owner_not_allowed')
        continue
      }
      if (decodedSelf.functionName === 'removeOwnerAtIndex') {
        if (!deploySessionSigner) throw new Error('deploy_session_missing')
        const ownerBytes = decodedSelf.args[1] as Hex
        const expected = asOwnerBytes(deploySessionSigner)
        if (String(ownerBytes).toLowerCase() !== String(expected).toLowerCase()) throw new Error('deploy_session_owner_mismatch')
        continue
      }

      throw new Error('selfcall_not_allowed')
    }

    if (mode === 'legacy_withdraw') {
      if (expectedVesting && c.target === expectedVesting) {
        if (selector !== SELECTOR_VESTING_RELEASE) throw new Error('legacy_vesting_selector_not_allowed')
        continue
      }
      if (expectedWrapper && c.target === expectedWrapper) {
        if (selector !== SELECTOR_WRAPPER_UNWRAP) throw new Error('legacy_wrapper_selector_not_allowed')
        continue
      }
      if (expectedVault && c.target === expectedVault) {
        if (!ALL_LEGACY_VAULT_SELECTORS.has(selector)) throw new Error('legacy_vault_selector_not_allowed')
        // emergencyWithdraw(uint256,address) – validate recipient is the sender
        if (selector === SELECTOR_VAULT_EMERGENCY_WITHDRAW) {
          const to = decodeAddressArgFromCalldata(c.data, 1)
          if (!to || getAddress(to) !== params.sender) throw new Error('legacy_emergency_withdraw_recipient_mismatch')
        }
        continue
      }
      throw new Error('legacy_target_not_allowed')
    }

    if (c.target === creatorVaultBatcher) {
      if (!ALLOWED_BATCHER_SELECTORS.has(selector)) throw new Error('batcher_selector_not_allowed')
      continue
    }
    if (vaultAuxiliaryDeployBatcher && c.target === vaultAuxiliaryDeployBatcher) {
      if (selector !== '0x3ed598cb') throw new Error('auxiliary_batcher_selector_not_allowed')
      {
        if (!expectedCreatorToken || !expectedVault || !expectedBurnStream || !expectedPayoutRouter || !expectedCreatorCoinPolicyController) {
          throw new Error('missing_expected_addresses')
        }
        let decodedAux: any
        try {
          decodedAux = decodeFunctionData({ abi: VAULT_AUXILIARY_DEPLOY_BATCHER_ABI as any, data: c.data })
        } catch {
          throw new Error('batcher_aux_decode_failed')
        }
        const p = decodedAux?.args?.[0]
        const codeIds = decodedAux?.args?.[1]
        const creatorTokenArg = p && isAddress(p.creatorToken) ? getAddress(p.creatorToken) : null
        const ownerArg = p && isAddress(p.owner) ? getAddress(p.owner) : null
        const vaultArg = p && isAddress(p.vault) ? getAddress(p.vault) : null
        const swapRouterArg = p && isAddress(p.swapRouter) ? getAddress(p.swapRouter) : null
        const wethArg = p && isAddress(p.weth) ? getAddress(p.weth) : null
        const protocolRewardsArg = p && isAddress(p.protocolRewards) ? getAddress(p.protocolRewards) : null
        if (!creatorTokenArg || creatorTokenArg !== expectedCreatorToken) throw new Error('batcher_aux_creator_mismatch')
        if (!ownerArg || ownerArg !== params.sender) throw new Error('batcher_aux_owner_mismatch')
        if (!vaultArg || vaultArg !== expectedVault) throw new Error('batcher_aux_vault_mismatch')
        if (!swapRouterArg || !allowedPayoutRouterV3Routers.has(swapRouterArg)) throw new Error('batcher_aux_swap_router_mismatch')
        if (!wethArg || wethArg !== BASE_WETH) throw new Error('batcher_aux_weth_mismatch')
        const protocolRewardsErr = validatePayoutRouterProtocolRewardsArg(protocolRewardsArg)
        if (protocolRewardsErr) throw new Error(protocolRewardsErr)
        const hasValidAuxiliaryCodeIds =
          codeIds &&
          typeof codeIds === 'object' &&
          isHexString(codeIds.vaultShareBurnStream) &&
          isHexString(codeIds.payoutRouter) &&
          isHexString(codeIds.creatorCoinPolicyController) &&
          String(codeIds.vaultShareBurnStream).toLowerCase() === String(VAULT_SHARE_BURN_STREAM_CODE_ID).toLowerCase() &&
          String(codeIds.payoutRouter).toLowerCase() === String(PAYOUT_ROUTER_CODE_ID).toLowerCase() &&
          String(codeIds.creatorCoinPolicyController).toLowerCase() ===
            String(CREATOR_COIN_POLICY_CONTROLLER_CODE_ID).toLowerCase()
        if (!hasValidAuxiliaryCodeIds) throw new Error('batcher_aux_codeids_mismatch')
      }
      continue
    }
    if (c.target === vaultActivationBatcher) {
      if (!ALLOWED_ACTIVATION_SELECTORS.has(selector)) throw new Error('activation_selector_not_allowed')
      continue
    }

    if (c.target === permit2) {
      if (!ALLOWED_PERMIT2_SELECTORS.has(selector)) throw new Error('permit2_selector_not_allowed')
      const permit2Abi = [
        {
          type: 'function',
          name: 'permitTransferFrom',
          stateMutability: 'nonpayable',
          inputs: [
            {
              name: 'permit',
              type: 'tuple',
              components: [
                {
                  name: 'permitted',
                  type: 'tuple',
                  components: [
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                  ],
                },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
              ],
            },
            {
              name: 'transferDetails',
              type: 'tuple',
              components: [
                { name: 'to', type: 'address' },
                { name: 'requestedAmount', type: 'uint256' },
              ],
            },
            { name: 'owner', type: 'address' },
            { name: 'signature', type: 'bytes' },
          ],
          outputs: [],
        },
      ] as const

      const decodedPermit2 = decodeFunctionData({ abi: permit2Abi, data: c.data })
      const permit = decodedPermit2.args[0] as any
      const details = decodedPermit2.args[1] as any
      const ownerArg = decodedPermit2.args[2] as Address
      if (getAddress(permit.permitted.token) !== expectedCreatorToken) throw new Error('permit2_token_mismatch')
      if (getAddress(details.to) !== params.sender) throw new Error('permit2_to_mismatch')
      if (getAddress(ownerArg) !== params.sessionAddress) throw new Error('permit2_owner_mismatch')
      continue
    }

    // Creator wallets must route stored-bytecode CREATE2 through DeploymentBatcher so
    // the create2 deployer ACL can authorize protocol deploy surfaces, not every CSW.
    if (c.target === create2DeployerFromStore) {
      throw new Error('direct_create2_deploy_not_allowed')
    }

    // PayoutRouter admin calls (phase2/phase3 deploy flow)
    if ((mode === 'deploy_phase2' || mode === 'deploy_phase3') && expectedPayoutRouter && c.target === expectedPayoutRouter) {
      if (!expectedProtocolTreasury || params.sender !== expectedProtocolTreasury) {
        throw new Error('payout_router_admin_sender_not_allowed')
      }
      if (
        selector !== SELECTOR_PAYOUT_ROUTER_SET_KEEPER &&
        selector !== SELECTOR_PAYOUT_ROUTER_SET_SWAP_PATH &&
        selector !== SELECTOR_PAYOUT_ROUTER_SET_EXTERNAL_SWAP_TARGET_APPROVAL &&
        selector !== SELECTOR_PAYOUT_ROUTER_SET_EXTERNAL_SWAP_SPENDER_APPROVAL
      ) {
        throw new Error('payout_router_selector_not_allowed')
      }

      let decodedRouter: any
      try {
        decodedRouter = decodeFunctionData({ abi: PAYOUT_ROUTER_ADMIN_ABI, data: c.data })
      } catch {
        throw new Error('payout_router_decode_failed')
      }

      if (decodedRouter.functionName === 'setKeeper') {
        if (!expectedPayoutRouterKeeper) throw new Error('payout_router_keeper_not_configured')
        const keeperArg = decodedRouter.args[0] as Address
        if (!keeperArg || getAddress(keeperArg) !== expectedPayoutRouterKeeper) {
          throw new Error('payout_router_keeper_mismatch')
        }
        continue
      }

      if (decodedRouter.functionName === 'setSwapPath') {
        if (!expectedCreatorToken) throw new Error('missing_creator_token')
        const tokenInArg = getAddress(decodedRouter.args[0] as Address)
        const pathArg = decodedRouter.args[1] as Hex
        const allowedSwapInputs = new Set<Address>([
          expectedWethToken,
          ...(expectedZoraToken ? [expectedZoraToken] : []),
        ])
        if (!allowedSwapInputs.has(tokenInArg)) throw new Error('payout_router_swap_token_not_allowed')
        if (!isHexString(pathArg)) throw new Error('payout_router_swap_path_invalid')
        const pathBytesLength = Math.max(0, Math.floor((pathArg.length - 2) / 2))
        if (pathBytesLength < 43 || (pathBytesLength - 20) % 23 !== 0) {
          throw new Error('payout_router_swap_path_invalid')
        }
        const pathStart = decodeAddressFromPackedPath(pathArg, 0)
        const pathEnd = decodeAddressFromPackedPath(pathArg, pathBytesLength - 20)
        if (!pathStart || pathStart !== tokenInArg) throw new Error('payout_router_swap_path_start_mismatch')
        if (!pathEnd || pathEnd !== expectedCreatorToken) throw new Error('payout_router_swap_path_end_mismatch')
        continue
      }

      if (decodedRouter.functionName === 'setExternalSwapTargetApproval') {
        const targetArg = getAddress(decodedRouter.args[0] as Address)
        const approvedArg = decodedRouter.args[1] as boolean
        if (approvedArg !== true) throw new Error('payout_router_external_approval_must_enable')
        if (!expectedPayoutRouterExternalTargets.has(targetArg)) {
          throw new Error('payout_router_external_target_not_allowed')
        }
        continue
      }

      if (decodedRouter.functionName === 'setExternalSwapSpenderApproval') {
        const spenderArg = getAddress(decodedRouter.args[0] as Address)
        const approvedArg = decodedRouter.args[1] as boolean
        if (approvedArg !== true) throw new Error('payout_router_external_approval_must_enable')
        if (!expectedPayoutRouterExternalSpenders.has(spenderArg)) {
          throw new Error('payout_router_external_spender_not_allowed')
        }
        continue
      }

      throw new Error('payout_router_selector_not_allowed')
    }

    // Vault admin calls (phase2/phase3 deploy flow)
    if ((mode === 'deploy_phase2' || mode === 'deploy_phase3') && expectedVault && expectedBurnStream && expectedPayoutRouter && c.target === expectedVault) {
      const phase3RuntimeSelectorAllowed =
        mode === 'deploy_phase3' &&
        (selector === SELECTOR_VAULT_SET_MINIMUM_TOTAL_IDLE || selector === SELECTOR_VAULT_DEPLOY_TO_STRATEGIES)
      if (
        selector !== SELECTOR_VAULT_SET_BURN_STREAM &&
        selector !== SELECTOR_VAULT_SET_BURN_STREAM_AUTHORIZED_QUEUER &&
        selector !== SELECTOR_VAULT_SET_WHITELIST &&
        !phase3RuntimeSelectorAllowed
      ) {
        throw new Error('vault_selector_not_allowed')
      }
      if (selector === SELECTOR_VAULT_SET_BURN_STREAM) {
        const burnStreamArg = decodeAddressArgFromCalldata(c.data, 0)
        if (!burnStreamArg || burnStreamArg !== expectedBurnStream) {
          params.debug?.({
            deployer: create2DeployerFromStore,
            storeEnv: envStore,
            storeFromDeployer: deployerStore,
            storeUsed: bytecodeStore,
            expectedVault,
            expectedBurnStream,
            expectedPayoutRouter,
            vaultBurnStreamArg: burnStreamArg,
          })
          throw new Error('vault_burn_stream_mismatch')
        }
      } else if (selector === SELECTOR_VAULT_SET_BURN_STREAM_AUTHORIZED_QUEUER) {
        const queuerArg = decodeAddressArgFromCalldata(c.data, 0)
        const authorizedArg = decodeBoolArgFromCalldata(c.data, 1)
        if (!queuerArg || queuerArg !== expectedPayoutRouter) throw new Error('vault_burn_stream_queuer_mismatch')
        if (authorizedArg !== true) throw new Error('vault_burn_stream_queuer_status_mismatch')
      } else if (selector === SELECTOR_VAULT_SET_WHITELIST) {
        const accountArg = decodeAddressArgFromCalldata(c.data, 0)
        const statusArg = decodeBoolArgFromCalldata(c.data, 1)
        if (!accountArg || accountArg !== expectedPayoutRouter) throw new Error('vault_whitelist_account_mismatch')
        if (statusArg !== true) throw new Error('vault_whitelist_status_mismatch')
      } else if (selector === SELECTOR_VAULT_SET_MINIMUM_TOTAL_IDLE) {
        // Phase3 runtime idle tuning is allowed for the expected vault.
      } else if (selector === SELECTOR_VAULT_DEPLOY_TO_STRATEGIES) {
        // Phase3 runtime deployment is allowed for the expected vault.
      }
      continue
    }

    // Dynamic token calls: only allow calls to the same creatorToken used in the primary call.
    if (c.target !== expectedCreatorToken) throw new Error('called_address_not_allowed')
    if (!ALLOWED_TOKEN_SELECTORS.has(selector)) throw new Error('token_selector_not_allowed')

    if (selector === SELECTOR_ERC20_APPROVE) {
      const spender = decodeAddressArgFromCalldata(c.data, 0)
      if (!spender) throw new Error('approve_decode_failed')
      const allowedSpenders = new Set<Address>([creatorVaultBatcher, vaultActivationBatcher, permit2])
      if (!allowedSpenders.has(spender)) throw new Error('approve_spender_not_allowed')
      continue
    }

    if (selector === SELECTOR_COIN_SET_PAYOUT_RECIPIENT) {
      if ((mode !== 'deploy_phase2' && mode !== 'deploy_phase3') || !expectedPayoutRouter) throw new Error('payout_recipient_not_allowed')
      const recipient = decodeAddressArgFromCalldata(c.data, 0)
      if (!recipient || recipient !== expectedPayoutRouter) throw new Error('payout_recipient_mismatch')
      continue
    }

    if (selector === SELECTOR_OWNABLE_TRANSFER_OWNERSHIP) {
      if (mode !== 'deploy_phase2' && mode !== 'deploy_phase3') throw new Error('transfer_ownership_not_allowed')
      if (!expectedCreatorCoinPolicyController) throw new Error('policy_controller_not_configured')
      const newOwner = decodeAddressArgFromCalldata(c.data, 0)
      if (!newOwner || newOwner !== expectedCreatorCoinPolicyController) {
        throw new Error('transfer_ownership_target_mismatch')
      }
      continue
    }
  }

  return { expectedCreatorToken, mode: mode ?? 'unknown' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  const debugRequested = String(req.headers?.['x-cv-paymaster-debug'] ?? '').trim() === '1'
  const debugEnabled = debugRequested || String(process.env.PAYMASTER_DEBUG ?? '').trim() === '1'
  const validationDebugContexts: Array<{
    method: string
    sender?: Address | null
    mode?: string | null
    expectedCreatorToken?: Address | null
    innerSelectors?: string[]
    innerTargets?: Address[]
  }> = []
  let debugStoreInfo:
    | {
        deployer: Address
        storeEnv: Address | null
        storeFromDeployer: Address | null
        storeUsed: Address
        expectedVault?: Address | null
        expectedBurnStream?: Address | null
        expectedPayoutRouter?: Address | null
        expectedCreatorCoinPolicyController?: Address | null
        payoutRouterBurnStreamArg?: Address | null
        vaultBurnStreamArg?: Address | null
      }
    | null = null

  function formatDebugStoreInfo(info: NonNullable<typeof debugStoreInfo>): string {
    const parts = [
      `deployer=${info.deployer}`,
      `storeUsed=${info.storeUsed}`,
      `storeEnv=${info.storeEnv ?? 'null'}`,
      `storeFromDeployer=${info.storeFromDeployer ?? 'null'}`,
      `expectedVault=${info.expectedVault ?? 'null'}`,
      `expectedBurnStream=${info.expectedBurnStream ?? 'null'}`,
      `expectedPayoutRouter=${info.expectedPayoutRouter ?? 'null'}`,
      `expectedCreatorCoinPolicyController=${info.expectedCreatorCoinPolicyController ?? 'null'}`,
      `payoutRouterBurnStreamArg=${info.payoutRouterBurnStreamArg ?? 'null'}`,
      `vaultBurnStreamArg=${info.vaultBurnStreamArg ?? 'null'}`,
    ]
    return parts.join(',')
  }

  if (req.method !== 'POST') {
    // Keep JSON-RPC clients happy (avoid transport-level failure masking).
    return res.status(200).json(jsonRpcError(null, -32600, 'Method not allowed'))
  }

  const limiter = checkRateLimit(
    rateLimitKey('paymaster-rpc', getClientIp(req)),
    RATE_LIMITS.paymasterRpc,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(200).json(jsonRpcError(null, -32005, 'Rate limit exceeded'))
  }

  const cdpEndpoint = getCdpEndpoint()
  if (!cdpEndpoint) {
    return res.status(200).json(jsonRpcError(null, -32000, 'CDP paymaster endpoint is not configured'))
  }

  // In production serverless, SIWE sessions MUST be signed with a stable secret.
  // If this is unset, /api/auth/verify and /api/paymaster may run on different instances and
  // the paymaster will always see "not authenticated".
  const sessionSecret = (process.env.AUTH_SESSION_SECRET ?? '').trim()
  const isVercel = Boolean((process.env.VERCEL ?? '').trim())
  if (isVercel && sessionSecret.length < 16) {
    return res.status(200).json(jsonRpcError(null, -32000, 'Server misconfigured: AUTH_SESSION_SECRET is not set'))
  }

  const body = await readJsonBody<unknown>(req, { maxBytes: PAYMASTER_MAX_BODY_BYTES }).catch(() => null)
  if (!body) {
    return res.status(200).json(jsonRpcError(null, -32600, 'Invalid JSON body'))
  }

  const requests: JsonRpcRequest[] = isRequestArray(body) ? body : isRequestObject(body) ? [body] : []
  if (requests.length === 0) {
    return res.status(200).json(jsonRpcError(null, -32600, 'Invalid JSON-RPC payload'))
  }

  for (const r of requests) {
    const method = typeof r?.method === 'string' ? r.method : ''
    if (!method) {
      return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32600, 'Missing method'))
    }
    if (!ALLOWED_METHODS.has(method)) {
      return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32601, `Method not allowed: ${method}`))
    }
  }

  try {
    // Require an authenticated principal for any sponsorship-related method.
    // - Primary: session (cookie or Authorization bearer token) or SIWA receipt.
    // - Secondary: deploy-session token (server-driven completion after one user signature).
    const principalAddress = readRequestPrincipalAddress(req, { lowercase: false })
    const customOwnerPolicyTokenHeader = readCustomOwnerPolicyHeader(req)

    // Validate sponsorship requests (UserOperations only).
    for (const r of requests) {
      const method = r.method as string
      if (!METHODS_REQUIRING_USEROP.has(method)) continue
      const extracted = extractUserOpAndEntryPoint(method, r.params)
      if (!extracted) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid params'))
      }

      if (extracted.entryPoint !== ENTRYPOINT_V06) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - unsupported entryPoint'))
      }
      if (typeof extracted.chainId === 'number' && extracted.chainId !== BASE_CHAIN_ID) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - unsupported chainId'))
      }

      const senderRaw = extracted.userOp?.sender
      const callDataRaw = extracted.userOp?.callData
      const initCodeRaw = extracted.userOp?.initCode
      if (typeof senderRaw !== 'string' || !isAddress(senderRaw)) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid userOperation.sender'))
      }
      if (!isHexString(callDataRaw) || callDataRaw === '0x') {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32602, 'Invalid userOperation.callData'))
      }

      const sender = getAddress(senderRaw)

      // FIX: FINDING-05 — enforce per-sender hourly UserOp sponsorship limit.
      // Preflight methods are intentionally weight 0; otherwise one visible
      // swap can consume several quota units before the actual submit.
      const sponsorshipLimit = checkSponsorshipLimit(sender, sponsorshipWeightForMethod(method))
      if (!sponsorshipLimit.allowed) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((sponsorshipLimit.resetAtMs - Date.now()) / 1000))))
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32005, 'Sponsorship limit exceeded for this sender'))
      }

      const callSummary = summarizeSmartWalletCallData(callDataRaw as Hex)
      const requestContext: {
        method: string
        sender?: Address | null
        mode?: string | null
        expectedCreatorToken?: Address | null
        innerSelectors?: string[]
        innerTargets?: Address[]
      } = {
        method,
        sender,
        innerSelectors: callSummary?.innerSelectors ?? [],
        innerTargets: callSummary?.innerTargets ?? [],
      }
      validationDebugContexts.push(requestContext)

      let sessionAddress: Address | null = null
      let deploySessionOwner: Address | null = null
      let canonicalEmbeddedOwner: Address | null = null
      let allowCleanupOnlyForInactiveDeploySession = false

      if (principalAddress) {
        sessionAddress = getAddress(principalAddress)
      } else {
        const hdr = readDeploySessionHeaders(req)
        if (!hdr) throw new Error('no_session')
        // Ensure header signature matches (prevents leaked DB token from being used externally).
        if (signDeployToken(hdr.token) !== hdr.signature) throw new Error('invalid_deploy_session_signature')
        const ds = await getDeploySessionByTokenHash(hashDeployToken(hdr.token))
        if (!ds) throw new Error('no_session')
        const expired = Date.parse(ds.expiresAt) <= Date.now()
        const failed = ds.step === 'failed'
        const completed = ds.step === 'completed'
        if (completed) throw new Error('deploy_session_inactive')
        // Allow cleanup-only requests even if the deploy session is expired/failed.
        allowCleanupOnlyForInactiveDeploySession = expired || failed
        sessionAddress = getAddress(ds.sessionAddress)
        deploySessionOwner = getAddress(ds.sessionSigner)
      }

      if (!sessionAddress) {
        return res.status(200).json(jsonRpcError((r as any)?.id ?? null, -32002, 'request denied - not authenticated'))
      }

      // Basic rate limit: per session address. Count only sponsorship
      // issuance/submission so a single UserOp preflight sequence doesn't
      // burn the session quota before the user can submit.
      enforceRateLimit(sessionAddress, sponsorshipWeightForMethod(method))
      const initCode = isHexString(initCodeRaw) ? (initCodeRaw as Hex) : null
      const factoryRaw = extracted.userOp?.factory
      const factoryDataRaw = extracted.userOp?.factoryData
      const factory = typeof factoryRaw === 'string' && isAddress(factoryRaw) ? getAddress(factoryRaw) : null
      const factoryData = isHexString(factoryDataRaw) ? (factoryDataRaw as Hex) : null
      const calls = decodeSmartWalletInnerCalls(callDataRaw as Hex)
      if (sessionAddress && !deploySessionOwner) {
        canonicalEmbeddedOwner = await resolveCanonicalEmbeddedOwnerForSender({
          sessionAddress,
          sender,
          calls,
        }).catch(() => null)
      }
      const validated = await validateSponsoredSmartWalletCalls({
        sender,
        sessionAddress,
        calls,
        deploySessionOwner,
        canonicalEmbeddedOwner,
        customOwnerPolicyToken: customOwnerPolicyTokenHeader,
        allowCleanupOnlyForInactiveDeploySession,
        initCode,
        factory,
        factoryData,
        debug: debugEnabled
          ? (info) => {
              debugStoreInfo = info
            }
          : undefined,
      })
      requestContext.mode = String(validated.mode ?? 'unknown')
      requestContext.expectedCreatorToken = validated.expectedCreatorToken ?? null
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'rate_limited') {
      return res.status(200).json(jsonRpcError(null, -32002, 'request denied - rate limited'))
    }
    if (err instanceof Error && err.message === 'not_allowlisted') {
      return res.status(200).json(jsonRpcError(null, -32002, 'request denied - vault allowlist required'))
    }
    if (err instanceof Error && err.message === 'allowlist_check_failed') {
      logger.error('[paymaster-proxy] allowlist check failed')
      return res.status(200).json(jsonRpcError(null, -32002, 'request denied - allowlist unavailable'))
    }
    const msg = err instanceof Error ? err.message : 'request denied'
    if (debugEnabled) {
      logger.warn('[paymaster-proxy] validation denied (debug)', {
        msg,
        debugStoreInfo,
        validationContexts: validationDebugContexts,
      })
    } else {
      logger.warn('[paymaster-proxy] validation denied', { msg })
    }
    const contextSummary = validationDebugContexts.length > 0 ? formatValidationContexts(validationDebugContexts) : ''
    if (debugRequested && debugStoreInfo) {
      res.setHeader('X-CV-Paymaster-Debug', formatDebugStoreInfo(debugStoreInfo))
      return res
        .status(200)
        .json(
          jsonRpcError(
            null,
            -32002,
            `request denied - ${msg} (debug ${formatDebugStoreInfo(debugStoreInfo)}${
              contextSummary ? `,context ${contextSummary}` : ''
            })`,
          ),
        )
    }
    if (debugRequested && contextSummary) {
      return res.status(200).json(jsonRpcError(null, -32002, `request denied - ${msg} (context ${contextSummary})`))
    }
    return res.status(200).json(jsonRpcError(null, -32002, `request denied - ${msg}`))
  }

  // Forward to CDP if validation passed.
  const supportedEntryPointsProbe = isSupportedEntryPointsProbe(requests)
  const firstRequestId = getFirstRequestId(requests)
  try {
    const upstream = await fetch(cdpEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await upstream.text()

    // CDP returns JSON-RPC responses. Some clients (viem) treat non-2xx HTTP as transport failures
    // and mask the JSON-RPC error. Prefer returning HTTP 200 with the JSON-RPC payload when possible.
    res.setHeader('Content-Type', 'application/json')
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        if (debugEnabled && !Array.isArray(parsed) && (parsed as any)?.error) {
          logger.warn('[paymaster-proxy] upstream denied userop (debug)', {
            upstreamError: (parsed as any).error,
            validationContexts: validationDebugContexts,
          })
        }
        if (debugRequested && !Array.isArray(parsed) && (parsed as any)?.error) {
          const contextSummary = validationDebugContexts.length > 0 ? formatValidationContexts(validationDebugContexts) : ''
          const errObj = (parsed as any).error
          const msg = typeof errObj?.message === 'string' ? errObj.message : String(errObj?.message ?? '')
          if (contextSummary && msg) {
            ;(parsed as any).error = { ...errObj, message: `${msg} (context ${contextSummary})` }
          }
        }
        return res.status(200).send(JSON.stringify(parsed))
      }
    } catch {
      // Non-JSON response from upstream.
    }

    const textLower = text.toLowerCase()
    const isVercelProtection =
      textLower.includes('vercel authentication') ||
      textLower.includes('x-vercel-protection-bypass') ||
      textLower.includes('authentication required')

    if (isVercelProtection) {
      return res.status(200).json(
        jsonRpcError(
          null,
          -32000,
          'CDP paymaster upstream is protected by Vercel authentication. Set CDP_PAYMASTER_URL to the Coinbase RPC endpoint (not a Vercel deployment URL), or configure a Vercel bypass token for server-to-server calls.',
        ),
      )
    }

    if (upstream.status < 200 || upstream.status >= 300) {
      return res.status(200).json(jsonRpcError(firstRequestId, -32000, `Upstream paymaster request failed (HTTP ${upstream.status})`))
    }

    if (supportedEntryPointsProbe) {
      return res.status(200).json(jsonRpcResult(firstRequestId, [ENTRYPOINT_V06]))
    }

    return res.status(200).json(jsonRpcError(firstRequestId, -32000, 'Upstream paymaster returned a non-JSON response'))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upstream request failed'
    logger.error('[paymaster-proxy] upstream error', { msg })
    if (supportedEntryPointsProbe) {
      return res.status(200).json(jsonRpcResult(firstRequestId, [ENTRYPOINT_V06]))
    }
    return res.status(200).json(jsonRpcError(firstRequestId, -32000, msg))
  }
}
