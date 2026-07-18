import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";

export const ROOM_1659_FRIEND_KEY = getAddress(
  "0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F",
);
export const ROOM_1659_CREATOR_COIN = getAddress(
  "0x5b674196812451B7cEC024FE9d22D2c0b172fa75",
);
export const ROOM_1659_TOKEN_ID = 1659n;
export const ROOM_1659_PAIR_FEE = 69_000_000_000_000_000n;
export const ROOM_1659_PAIR_VARIANT = 3;
export const ROOM_1659_POOL_TYPE = 2;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const MAX_UINT128 = (1n << 128n) - 1n;

export const ROOM_1659_ERC1155_ABI = [
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "approved", type: "bool" }],
  },
] as const;

export const ROOM_1659_ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "remaining", type: "uint256" }],
  },
] as const;

export const ROOM_1659_FACTORY_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "function",
    name: "bondingCurveAllowed",
    stateMutability: "view",
    inputs: [{ name: "bondingCurve", type: "address" }],
    outputs: [{ name: "allowed", type: "bool" }],
  },
  {
    type: "function",
    name: "protocolFeeMultiplier",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "multiplier", type: "uint256" }],
  },
  {
    type: "function",
    name: "isValidPair",
    stateMutability: "view",
    inputs: [{ name: "pair", type: "address" }],
    outputs: [{ name: "valid", type: "bool" }],
  },
  {
    type: "function",
    name: "createPairERC1155ERC20",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "nft", type: "address" },
          { name: "bondingCurve", type: "address" },
          { name: "assetRecipient", type: "address" },
          { name: "poolType", type: "uint8" },
          { name: "delta", type: "uint128" },
          { name: "fee", type: "uint96" },
          { name: "spotPrice", type: "uint128" },
          { name: "nftId", type: "uint256" },
          { name: "initialNFTBalance", type: "uint256" },
          { name: "initialTokenBalance", type: "uint256" },
          { name: "hookAddress", type: "address" },
          { name: "referralAddress", type: "address" },
        ],
      },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
  {
    type: "event",
    name: "NewERC1155Pair",
    anonymous: false,
    inputs: [
      { name: "poolAddress", type: "address", indexed: true },
      { name: "initialBalance", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ROOM_1659_XYK_CURVE_ABI = [
  {
    type: "function",
    name: "getBuyInfo",
    stateMutability: "view",
    inputs: [
      { name: "spotPrice", type: "uint128" },
      { name: "delta", type: "uint128" },
      { name: "numItems", type: "uint256" },
      { name: "feeMultiplier", type: "uint256" },
      { name: "protocolFeeMultiplier", type: "uint256" },
    ],
    outputs: [
      { name: "error", type: "uint8" },
      { name: "newSpotPrice", type: "uint128" },
      { name: "newDelta", type: "uint128" },
      { name: "inputValue", type: "uint256" },
      { name: "tradeFee", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getSellInfo",
    stateMutability: "view",
    inputs: [
      { name: "spotPrice", type: "uint128" },
      { name: "delta", type: "uint128" },
      { name: "numItems", type: "uint256" },
      { name: "feeMultiplier", type: "uint256" },
      { name: "protocolFeeMultiplier", type: "uint256" },
    ],
    outputs: [
      { name: "error", type: "uint8" },
      { name: "newSpotPrice", type: "uint128" },
      { name: "newDelta", type: "uint128" },
      { name: "outputValue", type: "uint256" },
      { name: "tradeFee", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
    ],
  },
] as const;

export const ROOM_1659_PAIR_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "transferOwnership",
    stateMutability: "payable",
    inputs: [
      { name: "newOwner", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "pairVariant",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "poolType",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "nft",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "nftId",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "bondingCurve",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "fee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint96" }],
  },
  {
    type: "function",
    name: "delta",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint128" }],
  },
  {
    type: "function",
    name: "spotPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint128" }],
  },
] as const;

export type Room1659UserOperationCall = {
  to: Address;
  value: bigint;
  data: Hex;
};

export type Room1659PairPlanConfig = {
  factory: Address;
  xykCurve: Address;
  pairOwner: Address;
  initialKeyBalance: bigint;
  initialCreatorCoinBalance: bigint;
  virtualKeyReserve: bigint;
  virtualCreatorCoinReserve: bigint;
  pairFee: bigint;
};

function requireNonzeroAddress(name: string, value: Address): void {
  if (getAddress(value) === ZERO_ADDRESS)
    throw new Error(`${name}_not_configured`);
}

export function assertRoom1659PairPlanConfig(
  config: Room1659PairPlanConfig,
): void {
  requireNonzeroAddress("SUDOSWAP_PAIR_FACTORY", config.factory);
  requireNonzeroAddress("SUDOSWAP_XYK_CURVE", config.xykCurve);
  requireNonzeroAddress("PAIR_OWNER", config.pairOwner);
  if (config.initialKeyBalance <= 0n)
    throw new Error("INITIAL_KEY_BALANCE_invalid");
  if (config.initialCreatorCoinBalance <= 0n) {
    throw new Error("INITIAL_CREATOR_COIN_BALANCE_invalid");
  }
  if (
    config.virtualKeyReserve <= 1n ||
    config.virtualKeyReserve > MAX_UINT128
  ) {
    throw new Error("VIRTUAL_KEY_RESERVE_invalid");
  }
  if (
    config.virtualCreatorCoinReserve <= 0n ||
    config.virtualCreatorCoinReserve > MAX_UINT128
  ) {
    throw new Error("VIRTUAL_CREATOR_COIN_RESERVE_invalid");
  }
  if (config.pairFee !== ROOM_1659_PAIR_FEE) {
    throw new Error("PAIR_FEE_must_equal_690_bps");
  }
}

export function buildRoom1659CreateCalls(
  config: Room1659PairPlanConfig,
): Room1659UserOperationCall[] {
  assertRoom1659PairPlanConfig(config);

  return [
    {
      to: ROOM_1659_FRIEND_KEY,
      value: 0n,
      data: encodeFunctionData({
        abi: ROOM_1659_ERC1155_ABI,
        functionName: "setApprovalForAll",
        args: [config.factory, true],
      }),
    },
    {
      to: ROOM_1659_CREATOR_COIN,
      value: 0n,
      data: encodeFunctionData({
        abi: ROOM_1659_ERC20_ABI,
        functionName: "approve",
        args: [config.factory, config.initialCreatorCoinBalance],
      }),
    },
    {
      to: config.factory,
      value: 0n,
      data: encodeFunctionData({
        abi: ROOM_1659_FACTORY_ABI,
        functionName: "createPairERC1155ERC20",
        args: [
          {
            token: ROOM_1659_CREATOR_COIN,
            nft: ROOM_1659_FRIEND_KEY,
            bondingCurve: config.xykCurve,
            assetRecipient: ZERO_ADDRESS,
            poolType: ROOM_1659_POOL_TYPE,
            delta: config.virtualKeyReserve,
            fee: config.pairFee,
            spotPrice: config.virtualCreatorCoinReserve,
            nftId: ROOM_1659_TOKEN_ID,
            initialNFTBalance: config.initialKeyBalance,
            initialTokenBalance: config.initialCreatorCoinBalance,
            hookAddress: ZERO_ADDRESS,
            referralAddress: ZERO_ADDRESS,
          },
        ],
      }),
    },
    {
      to: ROOM_1659_FRIEND_KEY,
      value: 0n,
      data: encodeFunctionData({
        abi: ROOM_1659_ERC1155_ABI,
        functionName: "setApprovalForAll",
        args: [config.factory, false],
      }),
    },
    {
      to: ROOM_1659_CREATOR_COIN,
      value: 0n,
      data: encodeFunctionData({
        abi: ROOM_1659_ERC20_ABI,
        functionName: "approve",
        args: [config.factory, 0n],
      }),
    },
  ];
}

export function buildRoom1659PairOwnershipTransferCall(
  pair: Address,
  pairOwner: Address,
): Room1659UserOperationCall {
  requireNonzeroAddress("PAIR", pair);
  requireNonzeroAddress("PAIR_OWNER", pairOwner);
  return {
    to: getAddress(pair),
    value: 0n,
    data: encodeFunctionData({
      abi: ROOM_1659_PAIR_ABI,
      functionName: "transferOwnership",
      args: [getAddress(pairOwner), "0x"],
    }),
  };
}
