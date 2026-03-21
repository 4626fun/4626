/**
 * Shared CRE configuration for 4626 automation workflows.
 *
 * All contract addresses, chain config, and ABI fragments live here so
 * individual workflows stay focused on logic.
 */

// ---------------------------------------------------------------------------
// Chain configuration
// ---------------------------------------------------------------------------

export const CHAINS = {
  base: {
    id: 8453,
    name: 'Base',
    rpcEnvKey: 'BASE_RPC_URL',
    /** LayerZero Endpoint ID */
    lzEid: 30184,
  },
  solana: {
    name: 'Solana',
    rpcEnvKey: 'SOLANA_RPC_URL',
    programId:
      process.env.SOLANA_PROGRAM_ID ??
      process.env.CREATOR_SHARE_HOOK_PROGRAM_ID ??
      'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU',
  },
} as const;

export type ChainKey = keyof typeof CHAINS;

// ---------------------------------------------------------------------------
// Contract addresses
// ---------------------------------------------------------------------------
// In multi-vault mode, addresses come from the registry API (see utils/registry.ts).
// In single-vault mode, addresses come from env vars (see secrets.example.env).
// Individual actions handle address resolution — config.ts only exports ABIs/constants.

/** Charm AlphaProVaultFactory on Base mainnet */
export const CHARM_FACTORY_ADDRESS = '0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa' as const;

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

/** Seconds between report() calls (24 hours) */
export const REPORT_INTERVAL_SECONDS = 86_400;

/** Seconds between oracle price staleness checks */
export const ORACLE_STALENESS_THRESHOLD = 1_800; // 30 min

/** Price delta (bps) that triggers a cross-chain broadcast */
export const ORACLE_BROADCAST_DELTA_BPS = 200; // 2 %

/** TWAP duration passed to updateCreatorPriceFromTWAP */
export const TWAP_DURATION = 1_800; // 30 min

/** TWAP duration for Ajna bucket suggestions */
export const AJNA_BUCKET_TWAP_DURATION = 1_800; // 30 min

/** Target LTV used for Ajna short-lending bucket selection (10000 = 100%) */
export const AJNA_BUCKET_TARGET_LTV_BPS = 7_000; // 70%

/** Minimum implied-price change before Ajna bucket manager attempts a move */
export const AJNA_BUCKET_PRICE_CHANGE_TRIGGER_BPS = 1_000; // 10%

/** Minimum bucket delta before moving Ajna liquidity */
export const AJNA_BUCKET_MOVE_THRESHOLD = 50; // ~1.25 ticks (50-index granularity)

/** Max bucket step per rebalance to avoid large jumps */
export const AJNA_BUCKET_MAX_STEP = 2500;

/** Cooldown between Ajna bucket moves (seconds) */
export const AJNA_BUCKET_MOVE_COOLDOWN_SECONDS = 3_600; // 1 hour

/** Optional search radius around stepped bucket for local liquidity */
export const AJNA_BUCKET_LIQUIDITY_SEARCH_RADIUS = 20;

/** TWAP duration for Charm rebalance trigger checks */
export const CHARM_REBALANCE_TWAP_DURATION = 1_800; // 30 min

/** Minimum implied-price change before Charm rebalance attempts */
export const CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS = 1_000; // 10%

/** VRF hub top-up target (2x minimumBalance = 0.01 ETH) */
export const VRF_TOPUP_TARGET_WEI = BigInt(0.01e18);

/** VRF hub minimum balance before topping up */
export const VRF_MIN_BALANCE_WEI = BigInt(0.005e18);

// ---------------------------------------------------------------------------
// ABI fragments — only the functions each workflow needs
// ---------------------------------------------------------------------------

export const VAULT_ABI = [
  // Read
  { type: 'function', name: 'coinBalance', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'deploymentThreshold', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'minimumTotalIdle', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalStrategyWeight', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'lastReport', inputs: [], outputs: [{ type: 'uint96' }], stateMutability: 'view' },
  { type: 'function', name: 'isShutdown', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'paused', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'keeper', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'totalAssets', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalAssetsAtLastReport', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  // Write
  { type: 'function', name: 'tend', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'report', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'deployToStrategies', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const;

export const ORACLE_ABI = [
  // Read
  { type: 'function', name: 'creatorPriceUSD', inputs: [], outputs: [{ type: 'int256' }], stateMutability: 'view' },
  { type: 'function', name: 'creatorPriceTimestamp', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'isPriceFresh', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'v4PoolConfigured', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'v3PoolConfigured', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'v3Pool', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'getV3TWAPTick', inputs: [{ name: 'duration', type: 'uint32' }], outputs: [{ type: 'int24' }], stateMutability: 'view' },
  { type: 'function', name: 'v3CreatorToken', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'v3UsdToken', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'v3CreatorDecimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'v3UsdDecimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  // Write
  {
    type: 'function',
    name: 'updateCreatorPriceFromTWAP',
    inputs: [{ name: 'twapDuration', type: 'uint32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'broadcastCreatorPrice',
    inputs: [
      { name: 'dstEids', type: 'uint32[]' },
      { name: 'options', type: 'bytes' },
    ],
    outputs: [{ type: 'tuple[]', components: [{ name: 'guid', type: 'bytes32' }, { name: 'nonce', type: 'uint64' }, { name: 'fee', type: 'tuple', components: [{ name: 'nativeFee', type: 'uint256' }, { name: 'lzTokenFee', type: 'uint256' }] }] }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getAjnaBucketFromV3TWAP',
    inputs: [{ name: 'twapDuration', type: 'uint32' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const CHARM_FACTORY_ABI = [
  {
    type: 'function',
    name: 'isVault',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

export const VRF_HUB_ABI = [
  // Read
  {
    type: 'function',
    name: 'getContractStatus',
    inputs: [],
    outputs: [
      { name: 'balance', type: 'uint256' },
      { name: 'minBalance', type: 'uint256' },
      { name: 'canSendResponses', type: 'bool' },
      { name: 'gasLimit', type: 'uint32' },
      { name: 'supportedChainsCount', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  { type: 'function', name: 'minimumBalance', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  // Write
  { type: 'function', name: 'fundContract', inputs: [], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'updateLocalPrice', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  // Events
  {
    type: 'event',
    name: 'ResponsePending',
    inputs: [
      { name: 'sequence', type: 'uint64', indexed: true },
      { name: 'requestId', type: 'uint256', indexed: true },
      { name: 'targetChain', type: 'uint32', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
] as const;

export const VRF_SPOKE_ABI = [
  {
    type: 'function',
    name: 'cleanupExpiredRequests',
    inputs: [{ name: 'requestIds', type: 'uint64[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 's_requests',
    inputs: [{ name: '', type: 'uint64' }],
    outputs: [
      { name: 'fulfilled', type: 'bool' },
      { name: 'exists', type: 'bool' },
      { name: 'provider', type: 'address' },
      { name: 'randomWord', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'isContract', type: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const;

export const CCA_AUCTION_ABI = [
  { type: 'function', name: 'isGraduated', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'sweepCurrencyBlock', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const;

export const CCA_STRATEGY_ABI = [
  // Read
  { type: 'function', name: 'currentAuction', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  // Write
  { type: 'function', name: 'sweepCurrency', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'sweepUnsoldTokens', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Solana timing constants
// ---------------------------------------------------------------------------

/** Seconds between Solana entry relay polls */
export const SOLANA_ENTRY_RELAY_INTERVAL = 30;

/** Seconds between Solana fee settlement polls */
export const SOLANA_FEE_FLUSH_INTERVAL = 300; // 5 min

/** Price deviation threshold for alerting (bps) */
export const SOLANA_PRICE_DEVIATION_ALERT_BPS = 1500; // 15%

/** Price deviation threshold for auto-recenter (bps) */
export const SOLANA_PRICE_DEVIATION_RECENTER_BPS = 2000; // 20%

/** Price deviation threshold for halt (bps) */
export const SOLANA_PRICE_DEVIATION_HALT_BPS = 5000; // 50%

// ---------------------------------------------------------------------------
// Solana ABI fragments (Base-side contracts for Keepr relay)
// ---------------------------------------------------------------------------

export const SOLANA_BRIDGE_ADAPTER_ABI = [
  {
    type: 'function',
    name: 'receiveFeeFromSolana',
    inputs: [
      { name: 'keeperPubkey', type: 'bytes32' },
      { name: 'shareOFT', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'processLotteryEntryFromSolana',
    inputs: [
      { name: 'keeperPubkey', type: 'bytes32' },
      {
        name: 'entries',
        type: 'tuple[]',
        components: [
          { name: 'buyerSolanaPubkey', type: 'bytes32' },
          { name: 'shareOFT', type: 'address' },
          { name: 'amountSolanaUnits', type: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}
