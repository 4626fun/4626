import type { Abi, Address, Hex } from "viem";

/**
 * Zora's account-manager proxy on Base mainnet. This is a custom
 * contract Zora deploys that wraps the vanilla CoinbaseSmartWalletFactory
 * and emits a purpose-built `ZoraSmartWalletCreated` event, giving us a
 * precise way to enumerate specifically-Zora-created smart wallets
 * (distinct from CSWs created by anyone else on Base).
 *
 * Source: https://github.com/ourzora/zora-protocol/blob/main/packages/smart-wallet/addresses/8453.json
 */
export const ZORA_ACCOUNT_MANAGER_ADDRESS: Address =
  "0x0Ba958A449701907302e28F5955fa9d16dDC45c3";

/**
 * The ZoraAccountManager is a UUPS proxy. This is the currently
 * configured implementation address — not something we typically
 * interact with directly, but useful for debugging if the implementation
 * ever rotates.
 */
export const ZORA_ACCOUNT_MANAGER_IMPL_ADDRESS: Address =
  "0x2810D376AC3b80C443ddD3F4e84E036F2e90622A";

/** Coinbase Smart Wallet factory — same across all chains. */
export const COINBASE_SMART_WALLET_FACTORY: Address =
  "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";

/** Base mainnet chain id. */
export const BASE_CHAIN_ID = 8453;

/**
 * keccak256("ZoraSmartWalletCreated(address,address,address[],uint256)")
 *
 * Precomputed so eth_getLogs topic filtering is O(1); cross-checked
 * against `cast keccak` at authoring time.
 */
export const ZORA_SMART_WALLET_CREATED_TOPIC: Hex =
  "0xb26d21ecd484109c7d09c990d6a96d3f53d24c091984c267c466dd9fb7df854c";

/**
 * Minimal ABI for event decoding. We only need the
 * ZoraSmartWalletCreated event; everything else is handled via raw calls.
 */
export const ZORA_ACCOUNT_MANAGER_ABI = [
  {
    type: "event",
    name: "ZoraSmartWalletCreated",
    inputs: [
      { name: "smartWallet", type: "address", indexed: true },
      { name: "baseOwner", type: "address", indexed: true },
      { name: "owners", type: "address[]", indexed: false },
      { name: "nonce", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

/**
 * CoinbaseSmartWallet owner-reading ABI. We call `ownerAtIndex(i)` in a
 * loop from i=0 until it reverts or returns empty bytes, accumulating
 * the current owner list including any owners added after deployment
 * via `addOwnerAddress`.
 *
 * Note: `ownerAtIndex` returns `bytes` because CSWs support both address
 * owners (32-byte abi-encoded address) and passkey owners (64-byte x,y
 * public-key coordinates). We accept both and surface the distinction.
 */
export const COINBASE_SMART_WALLET_ABI = [
  {
    type: "function",
    name: "ownerAtIndex",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "function",
    name: "ownerCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "nextOwnerIndex",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "removedOwnersCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const satisfies Abi;

/** Hard ceiling on owner enumeration — protects against pathological loops. */
export const MAX_OWNER_INDEX = 64;
