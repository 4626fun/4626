import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";

import {
  ALFACLUB_UNIVERSAL_ROUTER_ABI,
  FRIEND_KEY_ABI,
  PERMIT2_ALLOWANCE_TRANSFER_ABI,
} from "./contracts";

export const ALFACLUB_SUDOSWAP_BUY_COMMAND = 0x41;
export const ALFACLUB_SUDOSWAP_SELL_COMMAND = 0x42;
export const ALFACLUB_SUDOSWAP_INPUT_BYTES = 160;
export const MAX_UINT160 = (1n << 160n) - 1n;
export const MAX_UINT48 = (1n << 48n) - 1n;

const SUDOSWAP_INPUT_PARAMETERS = parseAbiParameters(
  "address pair, address recipient, uint256 keyAmount, uint256 limit, bool payerIsUser",
);

export type AlfaClubSudoswapDirection = "buy" | "sell";

export type AlfaClubSudoswapInput = {
  pair: Address;
  recipient: Address;
  keyAmount: bigint;
  limit: bigint;
  payerIsUser: boolean;
};

export type AlfaClubRouterCall = {
  to: Address;
  from: Address;
  data: Hex;
  value: "0";
  chainId: 8453;
};

export type Permit2AllowanceSnapshot = {
  amount: bigint;
  expiration: bigint;
};

export type AlfaClubSudoswapRoundTripCallsParams = {
  router: Address;
  adapter: Address;
  permit2: Address;
  friendKey: Address;
  creatorCoin: Address;
  pair: Address;
  sender: Address;
  keyAmount: bigint;
  buyLimit: bigint;
  sellLimit: bigint;
  deadline: bigint;
  erc20AllowanceToPermit2: bigint;
  permit2AllowanceToAdapter: Permit2AllowanceSnapshot;
  keyApprovedForAdapter: boolean;
};

export function encodeAlfaClubSudoswapInput(input: AlfaClubSudoswapInput): Hex {
  return encodeAbiParameters(SUDOSWAP_INPUT_PARAMETERS, [
    getAddress(input.pair),
    getAddress(input.recipient),
    input.keyAmount,
    input.limit,
    input.payerIsUser,
  ]);
}

export function decodeAlfaClubSudoswapInput(input: Hex): AlfaClubSudoswapInput {
  if ((input.length - 2) / 2 !== ALFACLUB_SUDOSWAP_INPUT_BYTES) {
    throw new Error("alfaclub_sudoswap_input_length_invalid");
  }
  const decoded = decodeAbiParameters(SUDOSWAP_INPUT_PARAMETERS, input);
  const result: AlfaClubSudoswapInput = {
    pair: getAddress(decoded[0]),
    recipient: getAddress(decoded[1]),
    keyAmount: decoded[2],
    limit: decoded[3],
    payerIsUser: decoded[4],
  };
  if (
    encodeAlfaClubSudoswapInput(result).toLowerCase() !== input.toLowerCase()
  ) {
    throw new Error("alfaclub_sudoswap_input_noncanonical");
  }
  return result;
}

export function encodeAlfaClubSudoswapExecute(params: {
  direction: AlfaClubSudoswapDirection;
  pair: Address;
  recipient: Address;
  keyAmount: bigint;
  limit: bigint;
  deadline: bigint;
}): Hex {
  if (params.deadline <= 0n || params.deadline > MAX_UINT48) {
    throw new Error("alfaclub_sudoswap_deadline_invalid");
  }
  const command =
    params.direction === "buy"
      ? ALFACLUB_SUDOSWAP_BUY_COMMAND
      : ALFACLUB_SUDOSWAP_SELL_COMMAND;
  return encodeFunctionData({
    abi: ALFACLUB_UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [
      `0x${command.toString(16).padStart(2, "0")}` as Hex,
      [
        encodeAlfaClubSudoswapInput({
          pair: params.pair,
          recipient: params.recipient,
          keyAmount: params.keyAmount,
          limit: params.limit,
          payerIsUser: true,
        }),
      ],
      params.deadline,
    ],
  });
}

export function buildAlfaClubSudoswapCalls(params: {
  direction: AlfaClubSudoswapDirection;
  router: Address;
  adapter: Address;
  permit2: Address;
  friendKey: Address;
  creatorCoin: Address;
  pair: Address;
  sender: Address;
  keyAmount: bigint;
  limit: bigint;
  deadline: bigint;
  erc20AllowanceToPermit2?: bigint;
  permit2AllowanceToAdapter?: Permit2AllowanceSnapshot;
  keyApprovedForAdapter?: boolean;
}): AlfaClubRouterCall[] {
  if (params.keyAmount <= 0n)
    throw new Error("alfaclub_sudoswap_key_amount_invalid");
  if (params.limit <= 0n) throw new Error("alfaclub_sudoswap_limit_invalid");

  const calls: AlfaClubRouterCall[] = [];
  const common = {
    from: getAddress(params.sender),
    value: "0" as const,
    chainId: 8453 as const,
  };

  if (params.direction === "buy") {
    if (params.limit > MAX_UINT160)
      throw new Error("alfaclub_sudoswap_limit_too_large");
    if ((params.erc20AllowanceToPermit2 ?? 0n) < params.limit) {
      calls.push({
        ...common,
        to: getAddress(params.creatorCoin),
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [getAddress(params.permit2), params.limit],
        }),
      });
    }

    const permit2Allowance = params.permit2AllowanceToAdapter;
    if (
      !permit2Allowance ||
      permit2Allowance.amount < params.limit ||
      permit2Allowance.expiration < params.deadline
    ) {
      calls.push({
        ...common,
        to: getAddress(params.permit2),
        data: encodeFunctionData({
          abi: PERMIT2_ALLOWANCE_TRANSFER_ABI,
          functionName: "approve",
          args: [
            getAddress(params.creatorCoin),
            getAddress(params.adapter),
            params.limit,
            Number(params.deadline),
          ],
        }),
      });
    }
  } else if (!params.keyApprovedForAdapter) {
    calls.push({
      ...common,
      to: getAddress(params.friendKey),
      data: encodeFunctionData({
        abi: FRIEND_KEY_ABI,
        functionName: "setApprovalForAll",
        args: [getAddress(params.adapter), true],
      }),
    });
  }

  calls.push({
    ...common,
    to: getAddress(params.router),
    data: encodeAlfaClubSudoswapExecute({
      direction: params.direction,
      pair: params.pair,
      recipient: params.sender,
      keyAmount: params.keyAmount,
      limit: params.limit,
      deadline: params.deadline,
    }),
  });
  return calls;
}

/**
 * Builds one atomic, approval-restoring buy/sell canary for the canonical CSW.
 *
 * The batch grants only the permissions needed for the quoted buy, buys one or
 * more keys, sells the same quantity back, and restores the starting ERC-20,
 * Permit2 amount, and ERC-1155 approval state. Permit2 normalizes a zero
 * expiration to the cleanup block timestamp. If either swap or cleanup
 * fails, the parent smart-wallet batch reverts all preceding calls.
 */
export function buildAlfaClubSudoswapRoundTripCalls(
  params: AlfaClubSudoswapRoundTripCallsParams,
): AlfaClubRouterCall[] {
  const buyCalls = buildAlfaClubSudoswapCalls({
    direction: "buy",
    router: params.router,
    adapter: params.adapter,
    permit2: params.permit2,
    friendKey: params.friendKey,
    creatorCoin: params.creatorCoin,
    pair: params.pair,
    sender: params.sender,
    keyAmount: params.keyAmount,
    limit: params.buyLimit,
    deadline: params.deadline,
    erc20AllowanceToPermit2: params.erc20AllowanceToPermit2,
    permit2AllowanceToAdapter: params.permit2AllowanceToAdapter,
  });
  const sellCalls = buildAlfaClubSudoswapCalls({
    direction: "sell",
    router: params.router,
    adapter: params.adapter,
    permit2: params.permit2,
    friendKey: params.friendKey,
    creatorCoin: params.creatorCoin,
    pair: params.pair,
    sender: params.sender,
    keyAmount: params.keyAmount,
    limit: params.sellLimit,
    deadline: params.deadline,
    keyApprovedForAdapter: params.keyApprovedForAdapter,
  });
  const common = {
    from: getAddress(params.sender),
    value: "0" as const,
    chainId: 8453 as const,
  };

  return [
    ...buyCalls,
    ...sellCalls,
    {
      ...common,
      to: getAddress(params.friendKey),
      data: encodeFunctionData({
        abi: FRIEND_KEY_ABI,
        functionName: "setApprovalForAll",
        args: [getAddress(params.adapter), params.keyApprovedForAdapter],
      }),
    },
    {
      ...common,
      to: getAddress(params.permit2),
      data: encodeFunctionData({
        abi: PERMIT2_ALLOWANCE_TRANSFER_ABI,
        functionName: "approve",
        args: [
          getAddress(params.creatorCoin),
          getAddress(params.adapter),
          params.permit2AllowanceToAdapter.amount,
          Number(params.permit2AllowanceToAdapter.expiration),
        ],
      }),
    },
    {
      ...common,
      to: getAddress(params.creatorCoin),
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [getAddress(params.permit2), params.erc20AllowanceToPermit2],
      }),
    },
  ];
}

export function addSlippageBps(value: bigint, slippageBps: bigint): bigint {
  if (value <= 0n) return 0n;
  if (slippageBps < 0n || slippageBps >= 10_000n) {
    throw new Error("alfaclub_sudoswap_slippage_invalid");
  }
  return (value * (10_000n + slippageBps) + 9_999n) / 10_000n;
}

export function subtractSlippageBps(
  value: bigint,
  slippageBps: bigint,
): bigint {
  if (value <= 0n) return 0n;
  if (slippageBps < 0n || slippageBps >= 10_000n) {
    throw new Error("alfaclub_sudoswap_slippage_invalid");
  }
  return (value * (10_000n - slippageBps)) / 10_000n;
}
