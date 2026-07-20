import { describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  parseAbi,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";
import {
  ALFACLUB_FRIEND_KEY,
  ALFACLUB_SPONSORED_ROUTER_ABI,
  ROOM_1659_CREATOR_COIN,
  validateAlfaClubLpCalls,
  type AlfaClubLpInnerCall,
} from "./alfaclubLpPolicy";
import { encodeMinimalWethFundingExecute } from "../../../src/lib/alfaclub/zoraFundingExecuteFixtures.js";

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
]);
const ERC1155_ABI = parseAbi([
  "function setApprovalForAll(address operator, bool approved)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
]);
const PAIR_ABI = parseAbi([
  "function changeSpotPrice(uint128 newSpotPrice)",
  "function changeDelta(uint128 newDelta)",
  "function changeFee(uint96 newFee)",
  "function withdrawERC20(address token, uint256 amount)",
  "function withdrawERC1155(address token, uint256[] ids, uint256[] amounts)",
]);
const PERMIT2_ABI = parseAbi([
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
]);
const INPUT_PARAMETERS = parseAbiParameters(
  "address pair, address recipient, uint256 keyAmount, uint256 limit, bool payerIsUser",
);

const ROUTER = getAddress("0x1000000000000000000000000000000000000001");
const ADAPTER = getAddress("0x2000000000000000000000000000000000000002");
const PAIR = getAddress("0x3000000000000000000000000000000000000003");
const FACTORY = getAddress("0x4000000000000000000000000000000000000004");
const XYK = getAddress("0x5000000000000000000000000000000000000005");
const SENDER = getAddress("0x6000000000000000000000000000000000000006");
const OTHER = getAddress("0x7000000000000000000000000000000000000007");
const PERMIT2 = getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
const NOW = 2_000_000_000n;
const DEADLINE = NOW + 600n;

const env = {
  ALFACLUB_UNIVERSAL_ROUTER: ROUTER,
  ALFACLUB_SUDOSWAP_ADAPTER: ADAPTER,
  ALFACLUB_ROOM_1659_SUDOSWAP_PAIR: PAIR,
  SUDOSWAP_PAIR_FACTORY: FACTORY,
  SUDOSWAP_XYK_CURVE: XYK,
  PERMIT2,
  ALFACLUB_LP_CREATOR_COIN: ROOM_1659_CREATOR_COIN,
  ALFACLUB_LP_TOKEN_ID: "1659",
  ALFACLUB_LP_MAX_KEY_AMOUNT: "100",
  ALFACLUB_LP_MAX_SLIPPAGE_BPS: "500",
};

function createClient(overrides: Record<string, unknown> = {}) {
  return {
    readContract: vi.fn(
      async ({
        address,
        functionName,
      }: {
        address: Address;
        functionName: string;
      }) => {
        const keyed = `${address.toLowerCase()}:${functionName}`;
        if (keyed in overrides) return overrides[keyed];
        if (functionName in overrides) return overrides[functionName];
        switch (functionName) {
          case "isValidPair":
            return true;
          case "factory":
            return FACTORY;
          case "pairVariant":
            return 3;
          case "poolType":
            return 2;
          case "token":
            return ROOM_1659_CREATOR_COIN;
          case "nft":
          case "friendKey":
            return ALFACLUB_FRIEND_KEY;
          case "nftId":
            return 1659n;
          case "bondingCurve":
          case "xykCurve":
            return XYK;
          case "fee":
            return 69_000_000_000_000_000n;
          case "owner":
            return SENDER;
          case "routerStatus":
            return [true, true];
          case "permit2":
            return PERMIT2;
          case "universalRouter":
            return ROUTER;
          case "markets":
            return [ROOM_1659_CREATOR_COIN, 1659n, true];
          case "SUDOSWAP_ADAPTER":
            return ADAPTER;
          case "getBuyNFTQuote":
          case "getSellNFTQuote":
            return [0, 0n, 0n, 1_000n, 10n, 5n];
          case "balanceOf":
            return address === ALFACLUB_FRIEND_KEY ? 100n : 10_000n;
          default:
            throw new Error(`unexpected read: ${keyed}`);
        }
      },
    ),
  };
}

function calls(
  direction: "buy" | "sell",
  limit = direction === "buy" ? 1_050n : 950n,
): AlfaClubLpInnerCall[] {
  const approvals: AlfaClubLpInnerCall[] =
    direction === "buy"
      ? [
          {
            target: ROOM_1659_CREATOR_COIN,
            value: 0n,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [PERMIT2, limit],
            }),
          },
          {
            target: PERMIT2,
            value: 0n,
            data: encodeFunctionData({
              abi: PERMIT2_ABI,
              functionName: "approve",
              args: [ROOM_1659_CREATOR_COIN, ADAPTER, limit, Number(DEADLINE)],
            }),
          },
        ]
      : [
          {
            target: ALFACLUB_FRIEND_KEY,
            value: 0n,
            data: encodeFunctionData({
              abi: ERC1155_ABI,
              functionName: "setApprovalForAll",
              args: [ADAPTER, true],
            }),
          },
        ];
  return [
    ...approvals,
    ...routerOnly({
      command: direction === "buy" ? "0x41" : "0x42",
      input: encodeAlfaClubSudoswapInput({
        pair: PAIR,
        recipient: SENDER,
        keyAmount: 2n,
        limit,
        payerIsUser: true,
      }),
    }),
  ];
}

function encodeAlfaClubSudoswapInput(input: {
  pair: Address;
  recipient: Address;
  keyAmount: bigint;
  limit: bigint;
  payerIsUser: boolean;
}): Hex {
  return encodeAbiParameters(INPUT_PARAMETERS, [
    input.pair,
    input.recipient,
    input.keyAmount,
    input.limit,
    input.payerIsUser,
  ]);
}

function routerOnly(
  params: {
    command?: Hex;
    input?: Hex;
    deadline?: bigint;
  } = {},
): AlfaClubLpInnerCall[] {
  return [
    {
      target: ROUTER,
      value: 0n,
      data: encodeFunctionData({
        abi: ALFACLUB_SPONSORED_ROUTER_ABI,
        functionName: "execute",
        args: [
          params.command ?? "0x41",
          [
            params.input ??
              encodeAlfaClubSudoswapInput({
                pair: PAIR,
                recipient: SENDER,
                keyAmount: 2n,
                limit: 1_050n,
                payerIsUser: true,
              }),
          ],
          params.deadline ?? DEADLINE,
        ],
      }),
    },
  ];
}

async function validate(
  batch: AlfaClubLpInnerCall[],
  overrides: Record<string, unknown> = {},
) {
  return validateAlfaClubLpCalls({
    calls: batch,
    sender: SENDER,
    client: createClient(overrides),
    env,
    nowSeconds: NOW,
  });
}

describe("AlfaClub Sudoswap paymaster policy", () => {
  it("accepts exact atomic buy approvals followed by command 0x41", async () => {
    await expect(validate(calls("buy"))).resolves.toEqual({
      creatorCoin: ROOM_1659_CREATOR_COIN,
      tokenId: 1659n,
      pool: PAIR,
    });
  });

  it("accepts canonical ETH funding before the Zora and Sudoswap legs", async () => {
    const amount = 1_000_000_000_000_000n;
    const batch: AlfaClubLpInnerCall[] = [
      {
        target: getAddress("0x4200000000000000000000000000000000000006"),
        value: amount,
        data: "0xd0e30db0",
      },
      {
        target: getAddress("0x4200000000000000000000000000000000000006"),
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [PERMIT2, amount],
        }),
      },
      {
        target: getAddress("0x6ff5693b99212da76ad316178a184ab56d299b43"),
        value: 0n,
        data: encodeMinimalWethFundingExecute({
          sender: SENDER,
          creatorCoin: ROOM_1659_CREATOR_COIN,
          inputAmount: amount,
          amountOutMinimum: 1n,
        }),
      },
      ...calls("buy"),
    ];

    await expect(validate(batch)).resolves.toEqual({
      creatorCoin: ROOM_1659_CREATOR_COIN,
      tokenId: 1659n,
      pool: PAIR,
    });
  });

  it("rejects a canonical ETH funding batch with unbound Zora router commands", async () => {
    const amount = 1_000_000_000_000_000n;
    const batch: AlfaClubLpInnerCall[] = [
      {
        target: getAddress("0x4200000000000000000000000000000000000006"),
        value: amount,
        data: "0xd0e30db0",
      },
      {
        target: getAddress("0x4200000000000000000000000000000000000006"),
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [PERMIT2, amount],
        }),
      },
      {
        target: getAddress("0x6ff5693b99212da76ad316178a184ab56d299b43"),
        value: 0n,
        data: "0x24856bc3",
      },
      ...calls("buy"),
    ];

    await expect(validate(batch)).rejects.toThrow(
      /alfaclub_sudoswap_eth_funding_commands_invalid/i,
    );
  });

  it("rejects a canonical ETH funding batch with a mismatched WETH approval", async () => {
    const batch = [
      {
        target: getAddress("0x4200000000000000000000000000000000000006"),
        value: 1_000_000_000_000_000n,
        data: "0xd0e30db0" as Hex,
      },
      {
        target: getAddress("0x4200000000000000000000000000000000000006"),
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [PERMIT2, 1n],
        }),
      },
      {
        target: getAddress("0x6ff5693b99212da76ad316178a184ab56d299b43"),
        value: 0n,
        data: "0x24856bc3" as Hex,
      },
      ...calls("buy"),
    ] satisfies AlfaClubLpInnerCall[];

    await expect(validate(batch)).rejects.toThrow(
      "alfaclub_sudoswap_weth_approval_mismatch",
    );
  });

  it("accepts FriendKey adapter approval followed by command 0x42", async () => {
    await expect(validate(calls("sell"))).resolves.toEqual({
      creatorCoin: ROOM_1659_CREATOR_COIN,
      tokenId: 1659n,
      pool: PAIR,
    });
  });

  it("accepts an exact atomic ERC-20 and ERC-1155 inventory deposit", async () => {
    const batch: AlfaClubLpInnerCall[] = [
      {
        target: ROOM_1659_CREATOR_COIN,
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [PAIR, 1_000n],
        }),
      },
      {
        target: ALFACLUB_FRIEND_KEY,
        value: 0n,
        data: encodeFunctionData({
          abi: ERC1155_ABI,
          functionName: "safeTransferFrom",
          args: [SENDER, PAIR, 1659n, 2n, "0x"],
        }),
      },
    ];
    await expect(validate(batch)).resolves.toEqual({
      creatorCoin: ROOM_1659_CREATOR_COIN,
      tokenId: 1659n,
      pool: PAIR,
    });
  });

  it("rejects inventory deposits bound to another pair or token ID", async () => {
    await expect(
      validate([
        {
          target: ROOM_1659_CREATOR_COIN,
          value: 0n,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [OTHER, 1_000n],
          }),
        },
      ]),
    ).rejects.toThrow("alfaclub_sudoswap_deposit_erc20_invalid");

    await expect(
      validate([
        {
          target: ALFACLUB_FRIEND_KEY,
          value: 0n,
          data: encodeFunctionData({
            abi: ERC1155_ABI,
            functionName: "safeTransferFrom",
            args: [SENDER, PAIR, 1660n, 1n, "0x"],
          }),
        },
      ]),
    ).rejects.toThrow("alfaclub_sudoswap_deposit_erc1155_invalid");
  });

  it("accepts pair-owner withdrawals and exact Room 1659 curve changes", async () => {
    const withdrawals: AlfaClubLpInnerCall[] = [
      {
        target: PAIR,
        value: 0n,
        data: encodeFunctionData({
          abi: PAIR_ABI,
          functionName: "withdrawERC20",
          args: [ROOM_1659_CREATOR_COIN, 100n],
        }),
      },
      {
        target: PAIR,
        value: 0n,
        data: encodeFunctionData({
          abi: PAIR_ABI,
          functionName: "withdrawERC1155",
          args: [ALFACLUB_FRIEND_KEY, [1659n], [1n]],
        }),
      },
    ];
    await expect(validate(withdrawals)).resolves.toMatchObject({ pool: PAIR });

    const configure: AlfaClubLpInnerCall[] = [
      {
        target: PAIR,
        value: 0n,
        data: encodeFunctionData({
          abi: PAIR_ABI,
          functionName: "changeSpotPrice",
          args: [20_000n],
        }),
      },
      {
        target: PAIR,
        value: 0n,
        data: encodeFunctionData({
          abi: PAIR_ABI,
          functionName: "changeDelta",
          args: [40n],
        }),
      },
      {
        target: PAIR,
        value: 0n,
        data: encodeFunctionData({
          abi: PAIR_ABI,
          functionName: "changeFee",
          args: [69_000_000_000_000_000n],
        }),
      },
    ];
    await expect(validate(configure)).resolves.toMatchObject({ pool: PAIR });
  });

  it("rejects owner actions from a non-owner and fee drift", async () => {
    const changeFee: AlfaClubLpInnerCall = {
      target: PAIR,
      value: 0n,
      data: encodeFunctionData({
        abi: PAIR_ABI,
        functionName: "changeFee",
        args: [1n],
      }),
    };
    await expect(validate([changeFee], { owner: OTHER })).rejects.toThrow(
      "alfaclub_sudoswap_pair_owner_mismatch",
    );
    await expect(validate([changeFee])).rejects.toThrow(
      "alfaclub_sudoswap_pair_fee_mismatch",
    );
  });

  it("rejects a Room 1659 pair whose trading fee drifts from 690 bps", async () => {
    await expect(
      validate(routerOnly(), { fee: 6_900_000_000_000_000n }),
    ).rejects.toThrow("alfaclub_sudoswap_pair_fee_mismatch");
  });

  it("rejects allow-revert and mixed router command plans", async () => {
    await expect(validate(routerOnly({ command: "0xc1" }))).rejects.toThrow(
      "alfaclub_sudoswap_command_not_allowed",
    );
    await expect(validate(routerOnly({ command: "0x4108" }))).rejects.toThrow(
      "alfaclub_sudoswap_command_not_allowed",
    );
  });

  it("rejects malformed command input length", async () => {
    await expect(validate(routerOnly({ input: "0x1234" }))).rejects.toThrow(
      "alfaclub_sudoswap_input_length_invalid",
    );
  });

  it("rejects wrong payer, recipient, or pair", async () => {
    await expect(
      validate(
        routerOnly({
          input: encodeAlfaClubSudoswapInput({
            pair: PAIR,
            recipient: SENDER,
            keyAmount: 2n,
            limit: 1_050n,
            payerIsUser: false,
          }),
        }),
      ),
    ).rejects.toThrow("alfaclub_sudoswap_payer_must_be_user");

    await expect(
      validate(
        routerOnly({
          input: encodeAlfaClubSudoswapInput({
            pair: PAIR,
            recipient: OTHER,
            keyAmount: 2n,
            limit: 1_050n,
            payerIsUser: true,
          }),
        }),
      ),
    ).rejects.toThrow("alfaclub_sudoswap_recipient_mismatch");

    await expect(
      validate(
        routerOnly({
          input: encodeAlfaClubSudoswapInput({
            pair: OTHER,
            recipient: SENDER,
            keyAmount: 2n,
            limit: 1_050n,
            payerIsUser: true,
          }),
        }),
      ),
    ).rejects.toThrow("alfaclub_sudoswap_pair_mismatch");
  });

  it("rejects stale, excessive, and zero deadlines", async () => {
    await expect(validate(routerOnly({ deadline: NOW - 1n }))).rejects.toThrow(
      "alfaclub_sudoswap_deadline_not_allowed",
    );
    await expect(
      validate(routerOnly({ deadline: NOW + 1_201n })),
    ).rejects.toThrow("alfaclub_sudoswap_deadline_not_allowed");
  });

  it("rejects buy and sell slippage outside the policy envelope", async () => {
    await expect(
      validate(
        routerOnly({
          input: encodeAlfaClubSudoswapInput({
            pair: PAIR,
            recipient: SENDER,
            keyAmount: 2n,
            limit: 1_051n,
            payerIsUser: true,
          }),
        }),
      ),
    ).rejects.toThrow("alfaclub_sudoswap_slippage_exceeds_policy");
    await expect(validate(calls("sell", 949n))).rejects.toThrow(
      "alfaclub_sudoswap_slippage_exceeds_policy",
    );
  });

  it("rejects a non-OK curve quote and a disabled adapter market", async () => {
    await expect(
      validate(routerOnly(), { getBuyNFTQuote: [1, 0n, 0n, 0n, 0n, 0n] }),
    ).rejects.toThrow("alfaclub_sudoswap_quote_error");
    await expect(
      validate(routerOnly(), {
        markets: [ROOM_1659_CREATOR_COIN, 1659n, false],
      }),
    ).rejects.toThrow("alfaclub_sudoswap_market_not_allowed");
  });

  it("rejects approvals to any spender other than Permit2 and the adapter", async () => {
    const batch = calls("buy");
    batch[0] = {
      ...batch[0]!,
      data: encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "approve",
            stateMutability: "nonpayable",
            inputs: [
              { name: "spender", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            outputs: [{ name: "", type: "bool" }],
          },
        ],
        functionName: "approve",
        args: [OTHER, 1_050n],
      }),
    };
    await expect(validate(batch)).rejects.toThrow(
      "alfaclub_sudoswap_erc20_approval_mismatch",
    );
  });

  it("returns null for unrelated batches without reading live policy config", async () => {
    await expect(
      validateAlfaClubLpCalls({
        calls: [{ target: OTHER, value: 0n, data: "0x12345678" }],
        sender: SENDER,
        client: createClient(),
        env: {},
        nowSeconds: NOW,
      }),
    ).resolves.toBeNull();
  });
});
